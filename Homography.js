/*Unique dependency. If needed it could be avoided in a future. It is only need when using Piecewise Affine Transforms*/
import Delaunator from 'https://cdn.skypack.dev/delaunator@5.0.0';

const availableTransforms = ['auto', 'piecewiseaffine', 'affine', 'projective'];

/**
 * @typedef {"auto"|"affine"|"piecewiseaffine"|"projective"} Transform
*/

const dims = 2;
// Max allowed width/height in normalized coordinates (just for allowing resizes up to x8)
const normalizedMax = 8.0;




class Homography {
    /**
     * Summary.           Class for performing geometrical transformations over images.
     * 
     * Description.       Homography is in charge of performing: Affine, Projective or PiecewiseAffine transformations over images,
     *                    in a way that is as transparent and simple to the user as possible. It is lightweight and specially intended
     *                    for real-time applications. For this purpose, this class keeps an internal state for avoiding redundant operations
     *                    when reused, therefore, critical performance comes when multiple transformations are done over the same image.
     * 
     * @constructs        Homography
     * @link              https://github.com/Eric-Canas/Homography.js
     *  
     * @param {Transform} [transform = "auto"]  String representing the transformation to be done. One of "auto", "affine", "piecewiseaffine" or "projective":
     *                                           · "auto" : Transformation will be automatically selected depending on the inputs given. Just take "auto" if you
     *                                                      don't know which kind of transform do you need. This is the default value.
     * 
     *                                           · "affine" : A geometrical transformation that ensures that all parallel lines of the input image will be parallel
     *                                                        in the output image. It will need exactly three source points to be set (and three destiny points). 
     *                                                        An affine transformation can only be composed by rotations, scales, shearings and reflections.
     * 
     *                                           · "piecewiseaffine" : A composition of several affine transforms that allows more complex constructions. This transforms
     *                                                                 generates a mesh of triangles with the source points and finds an independent affine transformation
     *                                                                 for each one of them. This way, it allows more complex transformation as, for example, sinusoidal forms.
     *                                                                 It can take any amount (greater than three) of reference points. When "piecewiseaffine" mode is selected,
     *                                                                 only the parts of the input image within a triangle will appear on the output image. If you want to ensure
     *                                                                 that the whole image appears in the output, ensure to set include reference point on each corner of the image.
     *  
     *                                            · "projective" : A transformation that shows how the an image change when the point of view of the observer is modified. 
     *                                                             It takes exactly four source points (and four destiny points). This is the transformation that should
     *                                                             be used when looking for perspective modifications.
     * 
     * @param {Number}              [width]     Optional width of the input image. If given, it will resize the input image to that width. Lower widths will imply faster
     *                                          transformations at the cost of lower resolution in the output image, while larger widths will produce higher resolution images
     *                                          at the cost of processing time. If null, it will use the original image width.
     * 
     * @param {Number}             [height]     Optional height of the input image. If given, it will resize the input image to that height. Lower heights will imply faster
     *                                          transformations at the cost of lower resolution in the output image, while larger heights will produce higher resolution images
     *                                          at the cost of processing time. If null, it will use the original image height.
     *   
     */
    constructor(transform = 'auto', width=null, height=null){
        // Width and Height refers to the input image. If width and height are given it will be resized.
        if (width !== null) width = Math.round(width);
        if (height !== null) height = Math.round(height);
        // Sets the source width and height
        this._width = width;
        this._height = height;
        // Sets the objective width and height to null since it is unkwnown until source and destiny points are set
        this._objectiveWidth = null;
        this._objectiveHeight = null;
        // Set the source and destiny points to null
        this._srcPoints = null; //Internal type: Float32Array
        this._dstPoints = null; //Internal type: Float32Array
        // Set the selected transform
        this.firstTransformSelected = transform.toLowerCase();
        this.transform = transform.toLowerCase();
        // Build the hidden canvas that will help to convert HTMLImageElements to flat Uint8 Arrays
        this._hiddenCanvas = document.createElement('canvas');
        this._hiddenCanvas.width = width;
        this._hiddenCanvas.height = height;
        this._hiddenCanvas.style.display = 'hidden';
        this._hiddenCanvasContext = this._hiddenCanvas.getContext("2d");
        // Sets the internal variables for the current image to null
        this._HTMLImage = null;
        this._image = null;
        // Set the auxiliar variables that are used in piecewiseAffine transforms for minimizing the computation performed
        this._maxSrcX = null;
        this._maxSrcY = null;
        this._minSrcX = null;
        this._minSrcY = null;
        // Sets to default (true) the variables that save the current range of the source and destiny arrays
        this._srcPointsAreNormalized = true;
        this._dstPointsAreNormalized = true;
        // Sets the auxiliar variable that will save for the source image, to which triangle of the mesh belongs each coord in "piecewiseaffine" 
        this._trianglesCorrespondencesMatrix = null;
        this._triangles = null;
        // Sets the variables that will save the transform matrices
        this._transformMatrix = null;
        this._piecewiseMatrices = null;
        // Allocate some auxiliar memory for avoiding to allocate any new memory during the "piecewiseaffine" matrix calculations 
        this._auxSrcTriangle = new Float32Array(3*dims);
        this._auxDstTriangle = new Float32Array(3*dims);
    }

    /**
     * Summary.                     Sets the source reference points ([[x1, y1], [x2, y2], ...]) of the transform and, optionally,
     *                              the image that will be transformed.
     * 
     * Description.                 Source reference points is a set of 2-D coordinates determined in the input image that will exactly go to
     *                              the correspondent destiny points coordinates (setted through setDstPoints()) in the output image. The rest
     *                              of coordinates of the image will be interpolated through the geometrical transform estimated f these ones.
     * 
     * @param {ArrayBuffer | Array}  points      Source points of the transform, given as a BufferArray or Array in the form [x1, y1, x2, y2...]
     *                                           or [[x1, y1], [x2, y2]...]. These source points should be declared in image coordinates, (x : [0, width],
     *                                           y : [0, height]) or in normalized coordinates (x : [0.0, 1.0], y : [0.0, 1.0]). To allow rescalings (from x0 to x8),
     *                                           normalized scale is automatically detected when the points array does not contain any value larger than 8.0.
     *                                           Coordinates with larger numbers are considered to be in image scale. For avoiding this automatic behaviour use the 
     *                                           pointsAreNormalized paremeter. Please note that, if width and height parameters are setted and points are given in
     *                                           image coordinates, these image coordinates should be declared in terms of the given width and height, (not in terms
     *                                           of the original image width/height).
     * 
     * @param {HTMLImageElement}     [image]     Optional source image, that will be warped later. Setting this element here will help to advance some calculations
     *                                           improving the later warping performance, specially when it is planned to apply multiple transformations (same source points
     *                                           different destiny points) to the same image. If width and/or height are given image will be internally rescaled previous
     *                                           to any transformation.
     * 
     * @param {Number}               [width]     Optional width of the input image. If given, it will resize the input image to that width. Lower widths will imply faster
     *                                           transformations at the cost of lower resolution in the output image, while larger widths will produce higher resolution images
     *                                           at the cost of processing time. If null, it will use the original image width.
     * 
     * @param {Number}               [height]    Optional height of the input image. If given, it will resize the input image to that height. Lower heights will imply faster
     *                                           transformations at the cost of lower resolution in the output image, while larger heights will produce higher resolution images
     *                                           at the cost of processing time. If null, it will use the original image height.
     * 
     * @param {Boolean}  [pointsAreNormalized]   Optional boolean determining if the parameter points is in normalized or in image coordinates. If not given it will be
     *                                           automatically inferred from the points array.
     * 
     */
    setSourcePoints(points, image = null, width = null, height = null, pointsAreNormalized = null){
        // If it is given as a list, transform it to an Float32Array for improving performance.
        if(!ArrayBuffer.isView(points)) points = new Float32Array(points.flat())
        // Set the source points property
        this._srcPoints = points;
        // Check if it is given in normalized coordinates (if this information is not given by the user).
        this._srcPointsAreNormalized = pointsAreNormalized === null? !containsValueGreaterThan(this._srcPoints, normalizedMax) : pointsAreNormalized;

        // Verifies if the selected transform is coherent with the points array given, or select the best one if 'auto' mode is selected.
        this.transform = checkAndSelectTransform(this.firstTransformSelected, this._srcPoints);

        // Unset objective width and height as they can change when source width/height is changed
        this._objectiveWidth = null;
        this._objectiveHeight = null;

        // Set the image property if given. If also given, it will also set the width and height as well as to resize the image.
        if (image !== null){
            this.setImage(image, width, height);
        // If no image was given but height and width were, set them.
        } else if (width !== null || height !== null){
            this._setSrcWidthHeight(width, height); //It will denormalize the srcPoints array
        }
        
        // In case that no width or height were given, but points were already in image coordinates, the "piecewiseaffine" correspondence matrix is still calculable.
        if (this.transform === 'piecewiseaffine' && this._trianglesCorrespondencesMatrix === null){
            // Unset any previous information about Piecewise Affine auxiliar matrices, as they are not reutilizable when source points are modified.
            this._triangles = null;
            this._piecewiseMatrices = null;
            // If there is information for calculating the auxiliar piecewise matrices, calculate them
            if (!this._srcPointsAreNormalized || (this._width > 0 && this._height > 0)){
                // Set all the parameters that can be already set
                this._setPiecewiseAffineTransformParameters();
            // Otherwise calculate only the tringles mesh, that is the unique that can be actually calculated.
            } else {
                this._triangles = Delaunay(this._srcPoints);
            }
        }
    }

    /**
     * Summary.                     Sets the image that will be transformed when warping.
     * 
     * Description.                 Setting the image before the destiny points (setDstPoints()) and the warping (call to warp()) will help to advance
     *                              calculations as well as to avoid future redundant calculations when successive calls to setDstPoints()->warp() will
     *                              occur in the future. It will severally improve the performance of applications that can take profit of that, as for
     *                              example those ones that have a static source image that must be continually adapted to different dstPoints detections
     *                              coming from a videoStream. This performance improvement will specially highligth for the "piecewiseaffine" transform,
     *                              as it is the one that is more computationally expensive.
     * 
     * @param {HTMLImageElement}  image    Image that will internally saved for future warping (warp()).
     * 
     * @param {Number}            [width]  Optional width. Resizes the input image to the given width. If not provided, original image width will be used
     *                                     (widths lowers than the original image width will improve speed at cost of resolution). It is not recommended
     *                                     to set widths below the expected output width, since at this point the speed improvement will dissapear and
     *                                     only resolution will be worsen.
     * 
     * @param {Number}            [height] Optional height. Resizes the input image to the given height. If not provided, original image height will be used
     *                                     (heights lowers than the original image height will improve speed at cost of resolution). It is not recommended
     *                                     to set heights below the expected output height, since at this point the speed improvement will dissapear and
     *                                     only resolution will be worsen.
     * 
     */
    setImage(image, width = null, height = null){
        // Set the current width and height of the input. As the width/height given by the user or the original width/height of the image if not given
        if (this._width === null || this._height === null){
            this._setSrcWidthHeight((width === null? image.width : width), (height === null? image.height : height));
        }
        
        // Sets the image as a flat Uint8ClampedArray, for dealing fast with it. It will also resize the image if needed.
        this._HTMLImage = image;
        this._image = this._getImageAsRGBAArray(image);

        // If source points are already set, now it is possible to calculate the "piecewiseaffine" parameters if needed.
        if(this._srcPoints !== null && this.transform === 'piecewiseaffine'){
            // Calculate all the auxiliar parameters that can be already calculated
            this._setPiecewiseAffineTransformParameters();
        }

        // If destiny points are already set but objectiveWidth and objectiveHeight are not, set them now.
        if (this._dstPoints !== null && (this._objectiveWidth <= 0 || this._objectiveHeight <= 0)){
            this._induceBestObjectiveWidthAndHeight();
        }
    }

    /**
     * Summary.                     Sets the destiny reference points ([[x1, y1], [x2, y2], ...]) of the transform.
     * 
     * Description.                 Destiny reference points is a set of 2-D coordinates determined for the output image. They must match with the
     *                              source points, as each source points of the input image will be transformed for going exactly to its correspondent
     *                              destiny points in the output image. The rest of coordinates of the image will be interpolated through the geometrical
     *                              transform estimated from these correspondences.
     * 
     * @param {ArrayBuffer | Array}    points    Destiny points of the transform, given as a BufferArray or Array in the form [x1, y1, x2, y2...]
     *                                           or [[x1, y1], [x2, y2]...]. These source destiny should be declared in image coordinates, (x : [0, width],
     *                                           y : [0, height]) or in normalized coordinates (x : [0.0, 1.0], y : [0.0, 1.0]). 
     *                                           To allow rescalings (from x0 to x8), normalized scale is automatically detected when the points array does not
     *                                           contain any value larger than 8.0. Coordinates with larger numbers are considered to be in image scale.
     *                                           For avoiding this automatic behaviour use the pointsAreNormalized paremeter.
     * 
     * @param {Boolean}  [pointsAreNormalized]   Optional boolean determining if the parameter points is in normalized or in image coordinates. If not given it will be
     *                                           automatically inferred from the points array.
     * 
     */
     setDstPoints(points, pointsAreNormalized = null){
        // Transform it to a typed array for perfomance reasons
        if(!ArrayBuffer.isView(points)) points = new Float32Array(points.flat());
        // Verify that these points matches with the source points
        if(points.length !== this._srcPoints.length) 
            throw(`It must be the same amount of destiny points (${points.length/dims}) than source points (${this._srcPoints.length/dims})`);
        // Set them
        this._dstPoints = points;
        this._dstPointsAreNormalized = pointsAreNormalized === null? !containsValueGreaterThan(this._dstPoints, normalizedMax) : pointsAreNormalized;

        // As both source and destiny points are set now, calculate the transformation matrix for whichever the selected transform is
        if (this.transform !== 'piecewiseaffine'){
            // Ensure that destiny and source points are in the same range
            this._putSrcAndDstPointsInSameRange();
            // Calculate the projective or the affine transform
            this._transformMatrix = calculateTransformMatrix(this.transform, this._srcPoints, this._dstPoints);
       } else {
           // Unset piecewiseMatrices as they turns invalid when dstPoints are changed
           this._piecewiseMatrices = null; 
       }
        
        // If there is enough information for calculating the objective width and height, calculate it
        if (this._image !== null || (this.transform === 'piecewiseaffine' && this._width > 0 && this._height > 0)){
            this._induceBestObjectiveWidthAndHeight();
        }
        
        // If Piecewise Affine transform was selected and there is enough information, calculate all the auxiliar structures
        if (this.transform === 'piecewiseaffine' && this._width > 0 && this._height > 0){
            // Transform the points to image coordinates if normalized coordinates were given
            if (this._dstPointsAreNormalized){
                denormalizePoints(this._dstPoints, this._width, this._height);
                this._dstPointsAreNormalized = false;
            }
            // Set the parameters piecewise affine parameters that can be already set
            this._setPiecewiseAffineTransformParameters();
        }
        
    }

    /**
     * Summary.                     Sets the destiny reference points ([[x1, y1], [x2, y2], ...]) of the transform.
     * 
     * Description.                 Apply the calculated homography to the given image. Output image will have enough width and height for enclosing the whole input image without
     *                              any crop or pad. Any void section of the output image will be transparent. If no image is passed to the function and it was setted before the
     *                              call of warp (recommended for performance reasons) warps the pre-setted image. In case that an image is given, it will be internally setted,
     *                              so any future call to warp() receiving no parameters will apply the transformation over this image again (It will be usually useful when the same
     *                              image is being constantly adapted to, for example, detections coming from a video stream). Remember that it will transform the whole input image
     *                              for "affine" and "projective" transforms, while for "piecewiseaffine" transforms it will only transform the parts of the image that can be connected
     *                              through the given source points. It occurs because "piecewiseaffine" transforms define different Affine transforms for different sections of the input
     *                              image, so it can not calculate transforms for undefined sections. If you want the whole output image in a "piecewiseaffine" transform you should set a
     *                              source point in each corner of the input image ([[x1, y1], [x2, y2], ..., [0, 0], [0, height], [width, 0], [width, height]]).
     * 
     * @param {HTMLImageElement}        [image]  Image that will transformed. If this parameter is not given since image was previously setted through `setImage(img)` or
     *                                           `setSrcPoints(points, img)`, this previously setted image will be the one that will be warped. If an image is given,
     *                                           it will be internally setted, so any future call to warp for transforming the same image could avoid to pass this image
     *                                           parameter again. This reuse of the image, if applicable, would speed up the transformation.
     * 
     * @param {Boolean}  [asHTMLPromise = false] If True, returns a Promise of an HTMLImageElement containing the Image, instead of an ImageData buffer. It could be convenient for some
     *                                           applications, but try to avoid it on critical performance applications as it would decrease its overall performance. If you need to
     *                                           draw it on a canvas, it can be directly done through context.putImageData(imgData, x, y).
     * 
     * @return {ImageData|Promise<HTMLImageElement>}  Transformed image in format ImageData or Promise of an HTMLImageElement if asHTMLPromise was set to true. ImageData buffers can be
     *                                                directly drawn on canvas by using context.putImageData(imgData, x, y).
     */

     warp(image = null, asHTMLPromise = false){
        // If the image was given, sets it internally (It will also recalculate any information that depends of it).
        if (image !== null){
            this.setImage(image);
        } else if (this._image === null){
            throw("warp() must receive an image if it was not setted before through `setImage(img)` or  `setSrcPoints(points, img)`");
        }
        let output_img;
        // Generate an image by applying the selected transform. If output image is larger than input image, apply the Inverse Transform instead in order to avoid holes in it.
        switch(this.transform){
            case 'piecewiseaffine':
                // If objectiveWidth or objectiveHeight are larger than width or height apply inverse transform, otherwise apply the source to destiny transfrom
                output_img = (this._objectiveWidth > this._width || this._objectiveHeight > this._height)?
                                                            this._inversePiecewiseAffineWarp(this._image) : this._piecewiseAffineWarp(this._image);
                break;
            case 'affine':
            case 'projective':
                // If objectiveWidth or objectiveHeight are larger than width or height apply inverse transform, otherwise apply the source to destiny transfrom 
                output_img = (this._objectiveWidth > this._width || this._objectiveHeight > this._height)?
                                                                    this._inverseGeometricWarp(this._image) : this._geometricWarp(this._image);
                break;
        }
        // Transform it from the Uint8ClampedArray flat form (better performance for calculating) to the ImageData form (more conve for the user).
        output_img = new ImageData(output_img, this._objectiveWidth, this._objectiveHeight);
        if (asHTMLPromise)
            return this.HTMLImageElementFromImageData(output_img);
        else 
            return output_img;
    }

    /**
     * Summary.                     Transforms an Image from its ImageData respresentation to an HTMLImageElement. NOTE: Remember to await for the promise to be resolved
     *                              (if asPromise is true (default)) or to the "onload" event (if asPromise is false).
     * 
     * Description.                 In performance critical applications such as, for example, real-time applications based on videoStreams it should be avoided when
     *                              possible as this transformation could decrease the overall framerate. Instead, if you need to draw the result image in a canvas,
     *                              try to do it directly through context.putImageData(imgData, x, y).
     *                               
     * 
     * @param {ImageData}  imgData                            Image to be transformed to an HTMLImageElement.
     * 
     * @param {Boolean}    [asPromise = true]                 If true (default), returns a Promise<HTMLImageElement> that ensures that the image is already loaded when resolved.
     *                                                        If false, directly returns the HTMLImageElement. In this case, the user must take care of not using it before the
     *                                                        "onload" event is triggered. 
     *  
     * @return {HTMLImageElement|Promise<HTMLImageElement>}   HTMLImageElement (or promise of it) containing the Image inside in the imgData buffer. This HTMLImageElement,
     *                                                        will also have the same width and height than this imgData buffer.
     */

    HTMLImageElementFromImageData(imgData, asPromise = true){// Obtain a blob: URL for the image data.
        let previousCanvasWidth = null;
        if (this._objectiveWidth !== this._hiddenCanvas.width){
            previousCanvasWidth = this._hiddenCanvas.width;
            this._hiddenCanvas.width = this._objectiveWidth;
        }
        let previousCanvasHeight = null;
        if (this._objectiveHeight !== this._hiddenCanvas.height){
            previousCanvasHeight = this._hiddenCanvas.height;
            this._hiddenCanvas.height = this._objectiveHeight;
        }

        this._hiddenCanvasContext.clearRect(0, 0, this._objectiveWidth, this._objectiveHeight);
        this._hiddenCanvasContext.putImageData(imgData, 0, 0);
        let img = document.createElement('img')
        img.src = this._hiddenCanvas.toDataURL();
        img.width = this._objectiveWidth;
        img.height = this._objectiveHeight;
        if (previousCanvasWidth !== null) {this._hiddenCanvas.width = previousCanvasWidth;}
        if (previousCanvasHeight !== null) {this._hiddenCanvas.height = previousCanvasHeight;}
        //document.body.append(img);
        if (asPromise){
            return new Promise((resolve, reject) => {
                img.onload = () => {resolve(img);};
                img.onerror = reject;
            });
        } else {
            return img;
        }
    }

    /* ----------------------------------------------- PRIVATE FUNCTIONS -------------------------------------------------- */
    /* ------------------------------ These functions should never be used by the user ------------------------------------ */
    
    //                              ----------------- Set Widths and Heights ---------------

    /**
     * 
     * Summary.                     PRIVATE. AVOID TO USE IT. Sets this._width and this._height properties in a consistent way with the rest of the object. 
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. It sets the source width and source height properties in an efficient and safe way. It ensures
     *                              that all modifications to dependant objects are done. It means that the hidden canvas, and the currently setted image are
     *                              resized if needed, that this._width and this._height are Integer numbers and that in the case of Piecewise Affine transform
     *                              the auxiliar matrices are recalculated.
     * 
     * @param {Number}    width     New width of the input. 
     * 
     * @param {Number}    height    New height of the input.
     * 
     */
    _setSrcWidthHeight(width, height){
        const last_width = this._width;
        const last_height = this._height;
        this._width = width;
        this._height = height;
        // If width and height are the same than before don't do anything. As all the previous structures are already valid
        if(last_width !== width || last_height !== height){
            this._width = Math.round(width);
            this._height = Math.round(height);
            // If source width is modified, delete the trianglesCorrespondenceMatrix, as it turns invalid.
            this._trianglesCorrespondencesMatrix = null;

            // Resize the hidden canvas if needed, for ensuring that no parts of the images will be lost in the HTMLImageElement->Uint8ClampedArray transformation. 
            if (this._hiddenCanvas.width < this._width) {this._hiddenCanvas.width = this._width;}
            if (this._hiddenCanvas.height < this._height) {this._hiddenCanvas.height = this._height;}

            // Resize the image if necessary
            if(this._image !== null && this._HTMLImage !== null){
                this._image = this._getImageAsRGBAArray(this._HTMLImage);
            }

            // Finally if piecewise affine transform set its parameters again as now it is sure that width and height are known
            if (this._srcPoints !== null && this.transform === 'piecewiseaffine'){
                this._setPiecewiseAffineTransformParameters();
            }
        }
    }


    /**
     * 
     * Summary.                     PRIVATE. AVOID TO USE IT. Induce the best value for the this._objectiveWidth and this._objectiveHeight properties.
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. It sets the destiny objectiveWidth and objectiveHeight properties in an efficient and safe way.
     *                              It ensures that all modifications to dependant objects are done. It means that the hidden canvas is resized if needed.
     *                              In case of Affine or Projective transforms are selected, and its transforms matrices are calculated or calculable (best case)
     *                              defines the objectiveWidth and objectiveHeight in order to fit the whole output image without any pad or crop. Otherwise,
     *                              it tries to do its best with the information available.
     * 
     */
    _induceBestObjectiveWidthAndHeight(){
        // Best case. Affine or Projective transform. In this case, it is possible to calculate the exact bounds of the output image.
        if ((this.transform === 'affine' || this.transform === 'projective')){
            // If transform matrix is not calculated by any reason, calculate it now.
            if (this._transformMatrix === null){
                if (this._srcPointsAreNormalized !== this._dstPointsAreNormalized){
                    this._putSrcAndDstPointsInSameRange();
                }
                this._transformMatrix = calculateTransformMatrix(this.transform, this._srcPoints, this._dstPoints);
            }
            // Set the output width and height variables to the limits of the estimated transformation
            [this._xOutputOffset, this._yOutputOffset, this._objectiveWidth, this._objectiveHeight] = calculateTransformLimits(this._transformMatrix, this._width, this._height); 
        // If piecewise transform is selected try if, at least, dstPoints are no normalized, so output width and height can be extracted from here. 
        } else if (!this._dstPointsAreNormalized){
            [this._xOutputOffset, this._yOutputOffset, this._objectiveWidth, this._objectiveHeight] = minmaxXYofArray(this._dstPoints);

            this._objectiveWidth = this._objectiveWidth - this._xOutputOffset;
            this._objectiveHeight = this._objectiveHeight - this._yOutputOffset;
            
        // If piecewise transform is selected and dstPoints are normalized, set as the denormalized version of dstPoints.
        } else if (this._width > 0 && this._height > 0){
            const [minDstX, minDstY , maxDstX, maxDstY] = minmaxXYofArray(this._dstPoints, false);
            this._xOutputOffset = Math.round(minDstX);
            this._yOutputOffset = Math.round(minDstY);
            this._objectiveWidth = Math.round((maxDstX-minDstX)*this._width);
            this._objectiveHeight = Math.round((maxDstY-minDstY)*this._height);
        } else {
            throw ("Trying to calculate a the output width and height of a Piecewise Affine transform but source width and height are not set");
        }

        // Finally modify the hidden canvas width and height if needed
        if (this._hiddenCanvas.width < this._objectiveWidth) {this._hiddenCanvas.width = this._objectiveWidth;}
        if (this._hiddenCanvas.height < this._objectiveHeight) {this._hiddenCanvas.height = this._objectiveHeight;}
    }

    //             ----------------- Set Piecewise Affine Transform Parameters ---------------

    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Sets the internal parameters for managing efficiently the piecewise affine transform.
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. Sets all the parameters that can be setted for the piecewise affine transform with
     *                              the current available information. It is, the Delaunay triangulation if the source points are set, the denormalization
     *                              of the source points if they are normalized and the input width and height is known. The triangles correspondence matrix
     *                              if it does not exist and there is enough information for building it. Finally, the affine transformation matrices. 
     * 
     */
    _setPiecewiseAffineTransformParameters(){
        if (this._srcPoints !== null){
            if (this._triangles === null){
                // Generate the triangles from the Delaunay method
                this._triangles = Delaunay(this._srcPoints);
            }
            // Denormalize source points if they are normalized. In order to build the matrix of triangles correspondence if possible.
            if (this._srcPointsAreNormalized){
                if (this._width > 0 && this._height > 0){
                    denormalizePoints(this._srcPoints, this._width, this._height);
                    this._srcPointsAreNormalized = false;
                } else {
                    throw("Trying to set the Piecewise Affine Transform parameters without knowing the source points ranges");
                }
            }

            // Try to set all the auxiliar parameters for performing the future "piecewise" transforms as fast as possible. Don't set them again if they already existed.
            // NOTE that it forces to unset them (set as null) when source points are modified.
            if (!this._srcPointsAreNormalized && (this._triangles === null || this._trianglesCorrespondencesMatrix === null)){
                // Set the maxSrcX and maxSrcY. By the program logic, if it happens it is ensured that it did not happen in setSourcePoints(points) function
                [this._minSrcX, this._minSrcY, this._maxSrcX, this._maxSrcY] = minmaxXYofArray(this._srcPoints);
                this._trianglesCorrespondencesMatrix = this._buildTrianglesCorrespondencesMatrix();
            }
            // If destiny points are known (as well as source points), build also the transformation matrices if they did not exist.
            // NOTE that it forces to unset piecewiseMatrices (set as null) when source points or destiny points are modified.
            if(this._dstPoints !== null && this._piecewiseMatrices === null && this._triangles !== null){
                if(this._dstPointsAreNormalized){
                    // Denormalize dstPoints for putting them in the same range than srcPoints
                    denormalizePoints(this._dstPoints, this._width, this._height);
                    this._dstPointsAreNormalized = false;
                }                
                this._piecewiseMatrices = this._calculatePiecewiseAffineTransformMatrices();
            }
        } else {
            throw("Trying to set the Piecewise Affine Transform parameters before setting the Source Points.")
        }
    }

    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Calculate the piecewise transform matrices.
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. Sets all the parameters that can be setted for the piecewise affine transform with
     *                              the current available information. It is, the Delaunay triangulation if the source points are set, the denormalization
     *                              of the source points if they are normalized and the input width and height is known. The triangles correspondence matrix
     *                              if it does not exist and there is enough information for building it. Finally, the affine transformation matrices. 
     * 
     */
    _calculatePiecewiseAffineTransformMatrices(){
        // Ensure that both source and destiny points are in the same range
        if (this._srcPointsAreNormalized !== this._dstPointsAreNormalized){
            this._putSrcAndDstPointsInSameRange();
        }
            let piecewiseMatrices = [];
            for(const triangle of this._triangles){
                // Set in the already allocated memory for doing it faster and keep it as an Int16Array (It would be nice to check other options (including async function))
                //Set the srcTriangle
                this._auxSrcTriangle[0] = this._srcPoints[triangle[0]*dims]; this._auxSrcTriangle[1] = this._srcPoints[triangle[0]*dims+1];
                this._auxSrcTriangle[2] = this._srcPoints[triangle[1]*dims]; this._auxSrcTriangle[3] = this._srcPoints[triangle[1]*dims+1];
                this._auxSrcTriangle[4] = this._srcPoints[triangle[2]*dims]; this._auxSrcTriangle[5] = this._srcPoints[triangle[2]*dims+1];
                //Set the dstTriangle
                this._auxDstTriangle[0] = this._dstPoints[triangle[0]*dims]; this._auxDstTriangle[1] = this._dstPoints[triangle[0]*dims+1];
                this._auxDstTriangle[2] = this._dstPoints[triangle[1]*dims]; this._auxDstTriangle[3] = this._dstPoints[triangle[1]*dims+1];
                this._auxDstTriangle[4] = this._dstPoints[triangle[2]*dims]; this._auxDstTriangle[5] = this._dstPoints[triangle[2]*dims+1];
                piecewiseMatrices.push(affineMatrixFromTriangles(this._auxSrcTriangle, this._auxDstTriangle))
            }
            return piecewiseMatrices;
    }

    
    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Builds the auxiliar matrix (this._trianglesCorrespondencesMatrix) that indicates, for each coordinate of the
     *                              input image, to which triangle of the input Piecewise mesh does it belongs.
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. This matrix is extremely relevant for performance reasons and constructing them in a suboptimal way would
     *                              incredibly harm the overall performance of the Piecewise Affine transforms. For this reason it reutilizes the this._auxSrcTriangle buffer
     *                              in order to avoid memory allocations. However, it is negligible as the way how _fillTriangle(...) is built is the really critical aspect that
     *                              determines the validity of the solution in terms of performance.
     *                              
     */
     _buildTrianglesCorrespondencesMatrix(){
        const matrixLength = (this._maxSrcX-this._minSrcX)*(this._maxSrcY - this._minSrcY);
        if (this._trianglesCorrespondencesMatrix === null || this._trianglesCorrespondencesMatrix.length !== matrixLength){
            this._trianglesCorrespondencesMatrix = new Int16Array(matrixLength);
        }
        this._trianglesCorrespondencesMatrix.fill(-1);
        
        for (const [i, triangle] of Object.entries(this._triangles)){
            //Set the srcTriangle
            this._auxSrcTriangle[0] = this._srcPoints[(triangle[0]<<1)]; this._auxSrcTriangle[1] = this._srcPoints[(triangle[0]<<1)+1];
            this._auxSrcTriangle[2] = this._srcPoints[(triangle[1]<<1)]; this._auxSrcTriangle[3] = this._srcPoints[(triangle[1]<<1)+1];
            this._auxSrcTriangle[4] = this._srcPoints[(triangle[2]<<1)]; this._auxSrcTriangle[5] = this._srcPoints[(triangle[2]<<1)+1];
            fillTriangle(this._auxSrcTriangle, i, this._maxSrcX-this._minSrcX, this._minSrcY, this._trianglesCorrespondencesMatrix);
        }
        return this._trianglesCorrespondencesMatrix;
    }

    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Destiny to Source version of this._buildTrianglesCorrespondencesMatrix(). It builds the auxiliar matrix
     *                              (this._trianglesCorrespondencesMatrix) that indicates, for each coordinate of the output image, to which triangle of the output
     *                              Piecewise mesh does it belongs.
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. This matrix is extremely relevant for performance reasons and constructing them in a suboptimal way would
     *                              incredibly harm the overall performance of the Piecewise Affine transforms. For this reason it reutilizes the this._auxDstTriangle buffer
     *                              in order to avoid memory allocations. However, it is negligible as the way how _fillTriangle(...) is built is the really critical aspect that
     *                              determines the validity of the solution in terms of performance.
     *                              
     */
    _buildInverseTrianglesCorrespondencesMatrix(){ 
        const matrixLength = this._objectiveWidth*this._objectiveHeight;
        if (this._trianglesCorrespondencesMatrix === null || this._trianglesCorrespondencesMatrix.length !== matrixLength){
            this._trianglesCorrespondencesMatrix = new Int16Array(matrixLength);
        }
        this._trianglesCorrespondencesMatrix.fill(-1);

        for (const [i, triangle] of Object.entries(this._triangles)){
            //Set the srcTriangle
            this._auxDstTriangle[0] = this._dstPoints[(triangle[0]<<1)]; this._auxDstTriangle[1] = this._dstPoints[(triangle[0]<<1)+1];
            this._auxDstTriangle[2] = this._dstPoints[(triangle[1]<<1)]; this._auxDstTriangle[3] = this._dstPoints[(triangle[1]<<1)+1];
            this._auxDstTriangle[4] = this._dstPoints[(triangle[2]<<1)]; this._auxDstTriangle[5] = this._dstPoints[(triangle[2]<<1)+1];
            fillTriangle(this._auxDstTriangle, i, this._objectiveWidth, this._yOutputOffset, this._trianglesCorrespondencesMatrix);
        }
       return this._trianglesCorrespondencesMatrix;
    }

    //                        ----------------- Ensure Points Consistency ---------------

    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Ensure that source and destiny points are in the same range (normalized or Image range).
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. It is extremely importante to ensure that all reference points are in the same range previous
     *                              to any transformation matrix estimation. When one of both points (source or destiny) must be calculated, this function 
     *                              prioritizes always the modification of the source points, as it is more usual that when multiple transformations are applied
     *                              sequentially (usually in video applications) destiny points are the ones that are constantly modified, while source points
     *                              remain unchanged. This way, future calculations are avoided. However, the affection of this function to the overall performance
     *                              is negligible.  
     * 
     */
    _putSrcAndDstPointsInSameRange(){
        // If they are not in the same range, try to always modify source. 
        // It should avoid future computation as destiny points will usually be given always in the same range. 
        if (this._dstPointsAreNormalized !== this._srcPointsAreNormalized){
            // If destiny array is normalized try to also normalize srcArray
            if (this._dstPointsAreNormalized && this._width > 0 && this._height > 0){
                normalizePoints(this._srcPoints, this._width, this._height);
                this._srcPointsAreNormalized = true;
            // Otherwise, try to denormalize source.
            } else if (this._srcPointsAreNormalized && this._width > 0 && this._height > 0){
                denormalizePoints(this._srcPoints, this._width, this._height);
                this._srcPointsAreNormalized = false;
            } else {
                throw("Impossible to put source and destiny points in the same range. Possible solutions: \n"+
                       "1. Give a source width/height when calling setSrcPoints.\n"+
                       "2. Set the input image before.\n"+
                       "3. Give Source and Destiny points in the same range (both normalized or both in image dimensions)")
            }
        }
        
    }

    //                        ---------------------- Warps ------------------------

    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Applies the source to destiny Affine or Projective transform.
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. Applies an Affine or Projective transform to the given image. It is by its nature the part of the code
     *                              where more computation is spent. Any change on this function will have the greatest implications in the performance
     * 
     * @param {Uint8ClampedArray}   image     Image to be transformed as Uint8ClampledArray. It will usually be the this._image property.
     * 
     * @return {Uint8ClampedArray}  Warped version of the input image. It will have a size of this._objectiveWidth*this.objectiveHeight*4 (RGBA channels).
     * 
     */
    _geometricWarp(image){
        const srcRowLenght = this._width<<2;
        const dstRowLenght = this._objectiveWidth<<2;
        let transformPoint = getTransformFunction(this.transform);
        // output_img starts as a fully transparent image (the whole alpha channel is filled with 0).
        let output_img = new Uint8ClampedArray(dstRowLenght*this._objectiveHeight);
        //We only check the points that can be inside a tringle, as the rest of points will not be translated in a piecewise warping.

        for (let y = 0; y < this._height; y++){
            for (let x = 0; x < this._width; x++){
                    //Get the index of y, x coordinate in the source image ArrayBuffer (<< 2 is a faster version of *4)
                    const idx = (y*srcRowLenght)+(x<<2);
                    let [newX, newY] = transformPoint(this._transformMatrix, x, y);
                    newX = Math.round(newX-this._xOutputOffset); newY = Math.round(newY-this._yOutputOffset);
                    //Get the index of y, x coordinate in the output image ArrayBuffer (<< 2 is a faster version of *4)
                    const newIdx = (newY*dstRowLenght)+(newX<<2);
                    output_img[newIdx] = image[idx], output_img[newIdx+1] = image[idx+1],
                    output_img[newIdx+2] = image[idx+2], output_img[newIdx+3] = image[idx+3];
            }    
        }    
        return output_img;
    }

    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Applies the source to destiny Piecewise Affine transform.
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. Applies a Piecewise Affine transform to the given image. It is by its nature the part of the code
     *                              where more computation is spent. Any change on this function will have the greatest implications in the performance. This function
     *                              needs the Piecewise Affine parameters to be set. They are: The triangulation, the trianglesCorrespondencesMatrix, and the Affine
     *                              transformations matrices of each triangle. 
     * 
     * @param {Uint8ClampedArray}   image     Image to be transformed as Uint8ClampledArray. It will usually be the this._image property.
     * 
     * @return {Uint8ClampedArray}  Warped version of the input image. It will have a size of this._objectiveWidth*this.objectiveHeight*4 (RGBA channels).
     * 
     */

    _piecewiseAffineWarp(image){
        const srcRowLenght = this._width<<2;
        const dstRowLenght = this._objectiveWidth<<2;
        const triangleCorrespondenceMatrixWidth = this._maxSrcX-this._minSrcX;
        // output_img starts as a fully transparent image (the whole alpha channel is filled with 0).
        let output_img = new Uint8ClampedArray(dstRowLenght*this._objectiveHeight);
        //We only check the points that can be inside a tringle, as the rest of points will not be translated in a piecewise warping.
        for (let y = this._minSrcY; y < this._maxSrcY; y++){
            for (let x = this._minSrcX; x < this._maxSrcX; x++){
                const inTriangle = this._trianglesCorrespondencesMatrix[(y-this._minSrcY)*triangleCorrespondenceMatrixWidth+(x-this._minSrcX)]
                if (inTriangle > -1){
                    //Get the index of y, x coordinate in the source image ArrayBuffer (<<2 is a faster version of *4)
                    const idx = (y*srcRowLenght)+(x<<2);
                    let [newX, newY] = applyAffineTransformToPoint(this._piecewiseMatrices[inTriangle], x, y);
                    newX = Math.round(newX-this._xOutputOffset); newY = Math.round(newY-this._yOutputOffset);
                    //Get the index of y, x coordinate in the output image ArrayBuffer (binary shift (<<2) is a faster version of *4)
                    const newIdx = (newY*dstRowLenght)+(newX<<2);
                    
                    output_img[newIdx] = image[idx], output_img[newIdx+1] = image[idx+1],
                    output_img[newIdx+2] = image[idx+2], output_img[newIdx+3] = image[idx+3]; 
                }
            }    
        }    
        return output_img;
    }

    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Destiny to source version of _geometricWarp(image).
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. Applies an inverse Affine or Projective transform to the given image. This version have worse performance than
     *                              than its forward version (_geometricWarp(image)), so it should be used only when this lose of performance is compensated. It is, when 
     *                              output image is larger, so the Source to Destiny version would generate a sparse image, or when output image is shorter enough in comparison
     *                              to the input image and therefore the additional overhead would be compensated by the lower amount of points to be calculated.  
     * 
     * @param {Uint8ClampedArray}   image     Image to be transformed as Uint8ClampledArray. It will usually be the this._image property.
     * 
     * @return {Uint8ClampedArray}  Warped version of the input image. It will have a size of this._objectiveWidth*this.objectiveHeight*4 (RGBA channels).
     * 
     */
     _inverseGeometricWarp(image){
        const srcRowLenght = this._width<<2;
        const dstRowLenght = this._objectiveWidth<<2;
        // output_img starts as a fully transparent image (the whole alpha channel is filled with 0).
        let output_img = new Uint8ClampedArray(dstRowLenght*this._objectiveHeight);
        // Calculate it in the opposite direction
        this._putSrcAndDstPointsInSameRange();
        const inverseTransformMatrix = calculateTransformMatrix(this.transform, this._dstPoints, this._srcPoints);
        let transformPoint = getTransformFunction(this.transform);
        // Track the full output image (going from _outputOffset to _objective+_outputOffset avoid white offsets)
        for (let y = this._yOutputOffset; y < this._objectiveHeight+this._yOutputOffset; y++){
            for (let x = this._xOutputOffset; x < this._objectiveWidth+this._xOutputOffset; x++){
                    let [srcX, srcY] = transformPoint(inverseTransformMatrix, x, y);   
                    //If point is inside source image
                    if (srcX >= 0 && srcX < this._width && srcY >= 0 && srcY < this._height){
                        //Get the index in the destiny domain
                        const idx = ((y-this._yOutputOffset)*dstRowLenght)+((x-this._xOutputOffset)<<2);
                        //Get the index of y, x coordinate in the output image ArrayBuffer
                        const srcIdx = (Math.round(srcY)*srcRowLenght)+(Math.round(srcX)<<2);
                        output_img[idx] = image[srcIdx], output_img[idx+1] = image[srcIdx+1],
                        output_img[idx+2] = image[srcIdx+2], output_img[idx+3] = image[srcIdx+3];
                    }
                    // Anything outside it is kept as transparent background
            }    
        }    
        return output_img;
    }

    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Destiny to source version of _piecewiseAffinecWarp(image).
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. Applies an inverse piecewise transform to the given image. This version have worse performance than
     *                              than its forward version (_piecewiseAffineWarp(image)), so it should be used only when this lose of performance is compensated. It is, when 
     *                              output image is larger, so the Source to Destiny version would generate a sparse image, or when output image is shorter enough in comparison
     *                              to the input image and therefore the additional overhead of generating the parameters again as inverting the Affine matrices of each triangle
     *                              would be compensated by the lower amount of points to be calculated.  
     * 
     * @param {Uint8ClampedArray}   image     Image to be transformed as Uint8ClampledArray. It will usually be the this._image property.
     * 
     * @return {Uint8ClampedArray}  Warped version of the input image. It will have a size of this._objectiveWidth*this.objectiveHeight*4 (RGBA channels).
     * 
     */
    _inversePiecewiseAffineWarp(image){
        
        const srcRowLenght = this._width<<2;
        const dstRowLenght = this._objectiveWidth<<2;
        const inverseTriangleCorrespondenceMatrix = this._buildInverseTrianglesCorrespondencesMatrix();
        const s0 = performance.now();   
        const triangleCorrespondenceMatrixWidth = this._objectiveWidth-this._xOutputOffset;
        let inversePiecewiseMatrices = []
        for (let i=0; i<this._piecewiseMatrices.length; i++){
            inversePiecewiseMatrices.push(inverseAffineMatrix(this._piecewiseMatrices[i]));
        }
        // output_img starts as a fully transparent image (the whole alpha channel is filled with 0).
        let output_img = new Uint8ClampedArray(dstRowLenght*this._objectiveHeight);
       
        for (let y = this._yOutputOffset; y < this._objectiveHeight+this._yOutputOffset; y++){
            for (let x = this._xOutputOffset; x < this._objectiveWidth+this._xOutputOffset; x++){
                const inTriangle = inverseTriangleCorrespondenceMatrix[(y-this._yOutputOffset)*triangleCorrespondenceMatrixWidth+(x-this._xOutputOffset)]
                if (inTriangle >= 0){
                    let [srcX, srcY] = applyAffineTransformToPoint(inversePiecewiseMatrices[inTriangle], x, y);
                    if (srcX >= 0 && srcX < this._width && srcY >= 0 && srcY < this._height){
                        srcX = Math.round(srcX); srcY = Math.round(srcY);
                        const srcIdx = (srcY*srcRowLenght)+(srcX<<2);
                        const dstIdx = ((y-this._yOutputOffset)*dstRowLenght)+((x-this._xOutputOffset)<<2);
                        output_img[dstIdx] = image[srcIdx], output_img[dstIdx+1] = image[srcIdx+1],
                        output_img[dstIdx+2] = image[srcIdx+2], output_img[dstIdx+3] = image[srcIdx+3];
                    }
                }
            }    
        }    
        console.log(`Inverse Bucle Performance: ${(performance.now()-s0)/1000} seconds`);
        return output_img;
    }
    
    /**
     * Summary.                     PRIVATE. AVOID TO USE IT. Transforms an HTMLImageElement in a flat Uint8ClampedArray of size this._width*this._height*4 (RGBA channels)
     * 
     * Description.                 PRIVATE. AVOID TO USE IT. In the process, the image is resized if this._width or this._height differs from the original image.width or
     *                              image.height.
     * 
     * @param {HTMLImageElement}    image  Image to be converted to Uint8ClampedArray flat format.
     * 
     * @return {Uint8ClampedArray}  Uint8ClampedArray of size this._width*this._height*4 (RGBA channels) containing the image.
     * 
     */
    _getImageAsRGBAArray(image){
        this._hiddenCanvasContext.clearRect(0, 0, this._width, this._height);
        this._hiddenCanvasContext.drawImage(image, 0, 0, this._width, this._height); //image.width, image.height);
        const imageRGBA = this._hiddenCanvasContext.getImageData(0, 0, this._width, this._height);
        return imageRGBA.data;
    }
    

}
export {Homography}

/*      ----------------------------------------------- AUXILIAR FUNCTIONS ---------------------------------------------------                   */
/*      ---------------------------- These functions will be not accessible for the user -------------------------------------                   */

//      ----------------------------------- To fill Piecewise Correspondence Matrix ------------------------------------------
/**
 * Summary.                     PRIVATE AUXILIAR. Fills all the coordinates of the given "trianglesCorrespondencesMatrix" that belongs to the given "triangle" with the
 *                              value of "idx".
 * 
 * Description.                 PRIVATE AUXILIAR. This function is critical for the performance of PiecewiseAffine Transforms. In order to be as fast as possible, it divides
 *                              the triangle in its three segments, and solves the equation of the line (y = mx + b) for each one of them. Then, for each row (y) of the matrix,
 *                              solves these equations for x (x = (y-b)/m). Then, as the triangle is the unique polygon that is always convex, fills the subsection of the y^{th}
 *                              row comprised between the minimum and the maximum x solutions.
 * 
 * @param {ArrayBuffer}        triangle  Three points of the triangle, represented as an ArrayBuffer of length 6 ([x1, y1, x2, y2, x3, y3]);
 * 
 * @return {Uint8ClampedArray}  Uint8ClampedArray of size this._width*this._height*4 (RGBA channels) containing the image.
 * 
 */
function fillTriangle(triangle, idx, matrix_width, yOffset, trianglesCorrespondencesMatrix){
    const minY = ~~Math.min(triangle[1], triangle[3], triangle[5]);
    const maxY = Math.ceil(Math.max(triangle[1], triangle[3], triangle[5]));
    //Set the the width to manage the offset of the matrix
    const trianglesCorrespondencesMatrixWidth = matrix_width;
    let xOrigin, xDestiny;
    const segments = defineTriangleSegments(triangle);
    for (let y = minY; y < maxY; y++){
        [xOrigin, xDestiny] = predictXLimits(segments, y);
        trianglesCorrespondencesMatrix.fill(idx, (y-yOffset)*trianglesCorrespondencesMatrixWidth + xOrigin, (y-yOffset)*trianglesCorrespondencesMatrixWidth + xDestiny);
        
    }
}


function defineTriangleSegments(triangle){
    // Equation of segment is y = mx + b. So x x = (y-b)/m. m = (y2-y1)/(x2-x1) and b = y - xm
    let [x0, y0, x1, y1, x2, y2] = triangle;
            // p0->1 
    return [{m : x1 !== x0? (y1-y0)/(x1-x0) : Infinity, b : (x1 !== x0)? y0 - x0*((y1-y0)/(x1-x0)) : x0, minY : Math.min(y1, y0), maxY : Math.max(y1, y0)},
            // p0->2 
            {m : x2 !== x0? (y2-y0)/(x2-x0) : Infinity, b : (x2 !== x0)? y0 - x0*((y2-y0)/(x2-x0)) : x0, minY : Math.min(y2, y0), maxY : Math.max(y2, y0)},
            // p1->2 
            {m : x2 !== x1? (y2-y1)/(x2-x1) : Infinity, b : (x2 !== x1)? y1 - x1*((y2-y1)/(x2-x1)) : x1, minY : Math.min(y2, y1), maxY : Math.max(y2, y1)}];
    
}

function predictXLimits(equations, y){
    //x = (y-b)/m
    //Calculate solution of every segment for x.
    let x;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i<equations.length; i++){
        if (y >= equations[i].minY && y <= equations[i].maxY){
            if (equations[i].m === Infinity){ //On vertical line just use the value of the vertex
                x = equations[i].b;
            } else if (equations[i].m === 0){ //Slope 0 -> No info about X
                continue;
            } else {
                x = ((y-equations[i].b)/equations[i].m);
            }
            if (x<min) min = x;
            if (x>max) max = x;
        } // else, the line does not collide with y
    }
    return [Math.round(min), Math.round(max)]
}


function Delaunay(points){
    const delaunay = new Delaunator(points);
    const triangles = delaunay.triangles;
    let triangles_idx = [];
    for (let i = 0; i < triangles.length; i += 3) {
        triangles_idx.push([triangles[i], triangles[i+1], triangles[i+2]]);
    }
    return triangles_idx;
}



function calculateTransformMatrix(transform, srcPoints, dstPoints){
    let matrix;
    switch(transform){
        case 'affine':
            matrix = affineMatrixFromTriangles(srcPoints, dstPoints);
            break;
        case 'projective':
            matrix = projectiveMatrixFromSquares(srcPoints, dstPoints);
            break;
        default:
            throw(`${transform} transform does not exist`);
    }
    return matrix;
}

function getTransformFunction(transform){
    switch(transform){
        case 'affine':
            return applyAffineTransformToPoint;
        case 'projective':
            return applyProjectiveTransformToPoint;
        default:
            throw(`${transform} transform does not exist`);
    }
}

function affineMatrixFromTriangles(srcTriangle, dstTriangle){
    /**
     * Gets the 2x3 transform matrix from two triangles got as TypedArray of positions (for performance reasons)
     */
        
        // Set the [[a, b, c], [d, e, f]] points of the matrix but as variables, for avoiding memory allocations until the last moment
        // Src matrix (that will be inversed later)
        const srcE = srcTriangle[4];
        const srcF = srcTriangle[5];

        const srcA = srcTriangle[0]-srcE;
        const srcB = srcTriangle[1]-srcF;
        const srcC = srcTriangle[2]-srcE;
        const srcD = srcTriangle[3]-srcF;

        // Dst matrix (that will be fix)
        const dstE = dstTriangle[4];
        const dstF = dstTriangle[5];

        const dstA = dstTriangle[0]-dstE;
        const dstB = dstTriangle[1]-dstF;
        const dstC = dstTriangle[2]-dstE;
        const dstD = dstTriangle[3]-dstF;
      
        //Inverse the source matrix
        const denominator = srcA * srcD - srcB * srcC;
        
        const invSrcA = srcD / denominator;
        const invSrcB = srcB / -denominator;
        const invSrcC = srcC / -denominator;
        const invSrcD = srcA / denominator;
        const invSrcE = (srcD * srcE - srcC * srcF) / -denominator;
        const invSrcF = (srcB * srcE - srcA * srcF) / denominator;

        // Define the affineMatrix as the matrix multiplication of dstMatrix * srcMatrix'
        const affineMatrix = new Float32Array([
            (dstA * invSrcA) + (dstC * invSrcB), // a
            (dstB * invSrcA) + (dstD * invSrcB), // b
            (dstA * invSrcC) + (dstC * invSrcD), // c
            (dstB * invSrcC) + (dstD * invSrcD), // d
            (dstA * invSrcE) + (dstC * invSrcF) + dstE, //e
            (dstB * invSrcE) + (dstD * invSrcF) + dstF  //f
        ]);
        // Some codes rounds it to a maximum decimal for smoothing reasons
        return affineMatrix

}

function inverseAffineMatrix(matrix){
    /**
     * Gets the 2x3 transform matrix from two triangles got as TypedArray of positions (for performance reasons)
     */
        
        // Set the [[a, b, c], [d, e, f]] points of the matrix but as variables, for avoiding memory allocations until the last moment
        // Src matrix (that will be inversed later)
        const srcA = matrix[0];
        const srcB = matrix[1];
        const srcC = matrix[2];
        const srcD = matrix[3];
        const srcE = matrix[4];
        const srcF = matrix[5];
        let invMatrix = new Float32Array(6)
        //Inverse the source matrix
        const denominator = srcA * srcD - srcB * srcC;
        
        invMatrix[0] = srcD / denominator;
        invMatrix[1] = srcB / -denominator;
        invMatrix[2] = srcC / -denominator;
        invMatrix[3] = srcA / denominator;
        invMatrix[4] = (srcD * srcE - srcC * srcF) / -denominator;
        invMatrix[5] = (srcB * srcE - srcA * srcF) / denominator;

        return invMatrix;

}

function calculateTransformLimits(matrix, width, height){
    let p0_0, p1_0, p0_1, p1_1;
    // Affine Transform Case
    if (matrix.length === 6){
        p0_0 = applyAffineTransformToPoint(matrix, 0, 0);
        p1_0 = applyAffineTransformToPoint(matrix, 0, height);
        p0_1 = applyAffineTransformToPoint(matrix, width, 0);
        p1_1 = applyAffineTransformToPoint(matrix, width, height);
    // Projective Transform Case
    } else if (matrix.length === 8){
        p0_0 = applyProjectiveTransformToPoint(matrix, 0, 0);
        p1_0 = applyProjectiveTransformToPoint(matrix, 0, height);
        p0_1 = applyProjectiveTransformToPoint(matrix, width, 0);
        p1_1 = applyProjectiveTransformToPoint(matrix, width, height);
    } else {
        throw(`Transform matrix have an incorrect shape --> ${matrix}`);
    }
    // It must check all the points in order to allow mirroring
    const xOutputOffset = Math.min(p0_0[0], p1_0[0], p0_1[0], p1_1[0]);
    const yOutputOffset = Math.min(p0_0[1], p0_1[1], p1_0[1], p1_1[1]);
    const outWidth = Math.max(p0_1[0], p1_1[0], p0_0[0], p1_0[0]) - xOutputOffset;
    const outHeight = Math.max(p1_0[1], p1_1[1], p0_0[1], p0_1[0]) - yOutputOffset;
    return [Math.round(xOutputOffset), Math.round(yOutputOffset), Math.round(outWidth), Math.round(outHeight)];

}

function checkAndSelectTransform(transform, points){
    /**
     * Verifies that this.srcPoints is in accordance with the selected transform, or select one transform if 'auto' 
     */

    switch(transform){
        case 'auto': 
            if (points.length === 3*dims) transform = 'affine';
            else if (points.length === 4*dims) transform = 'projective';
            else if (points.length > 4*dims) transform = 'piecewiseaffine';
            else throw(`Transforms must contain at least 3 points but only ${points.length/dims} were given`);
            break;
        
        case 'piecewiseaffine':
            // If it have only 3 points it is an affine transform.
            if (points.length === 3*dims){
                transform = 'affine';
                console.warn('Only 3 source points given but "piecewiseAffine" transform selected. Transform changed to "affine".');
            } else if (points.length < 3*dims){
                throw(`A piecewise (or affine) transform needs to determine least three reference points but only ${points.length/dims} were given`);
            }
            // Correct
            break;
        case 'affine':
            if (points.length !== 3*dims){
                throw(`An affine transform needs to determine exactly three reference points but ${points.length/dims} were given`)
            }
            //Correct
            break;
        case 'projective':
            if (points.length !== 4*dims){
                throw(`A projective transform needs to determine exactly four reference points but ${points.length/dims} were given`)
            }
            //Correct
            break;
        default:
            throw(`Transform "${transform}" is unknown`)
    }
    return transform;
}

function applyAffineTransformToPoint(matrix, x, y){
    return [(matrix[0] * x) + (matrix[2] * y) + matrix[4], //x
            (matrix[1] * x) + (matrix[3] * y) + matrix[5]] //y
}


function applyProjectiveTransformToPoint(matrix, x, y){
    return [(matrix[0]*x + matrix[1]*y + matrix[2]) / (matrix[6]*x + matrix[7]*y + 1),   //x
            (matrix[3]*x + matrix[4]*y + matrix[5]) / (matrix[6]*x + matrix[7]*y + 1)]; //y
}

function projectiveMatrixFromSquares(srcSquare, dstSquare){
    /**
     * Gets the 4x2 transform matrix from two squares, got as TypedArray of positions (for performance reasons)
     */
     const A = [[srcSquare[0], srcSquare[1], 1, 0, 0, 0, -dstSquare[0]*srcSquare[0], -dstSquare[0]*srcSquare[1]],
                [0, 0, 0, srcSquare[0], srcSquare[1], 1, -dstSquare[1]*srcSquare[0], -dstSquare[1]*srcSquare[1]],
                [srcSquare[2], srcSquare[3], 1, 0, 0, 0, -dstSquare[2]*srcSquare[2], -dstSquare[2]*srcSquare[3]],
                [0, 0, 0, srcSquare[2], srcSquare[3], 1, -dstSquare[3]*srcSquare[2], -dstSquare[3]*srcSquare[3]],
                [srcSquare[4], srcSquare[5], 1, 0, 0, 0, -dstSquare[4]*srcSquare[4], -dstSquare[4]*srcSquare[5]],
                [0, 0, 0, srcSquare[4], srcSquare[5], 1, -dstSquare[5]*srcSquare[4], -dstSquare[5]*srcSquare[5]],
                [srcSquare[6], srcSquare[7], 1, 0, 0, 0, -dstSquare[6]*srcSquare[6], -dstSquare[6]*srcSquare[7]],
                [0, 0, 0, srcSquare[6], srcSquare[7], 1, -dstSquare[7]*srcSquare[6], -dstSquare[7]*srcSquare[7]]];
     
     const H = solve(A,dstSquare,true);

     /*
     for(let i=0; i<8; i+=2){
        const [a, c] = applyProjectiveTransformToPoint(H, srcSquare[i], srcSquare[i+1], true)
        console.log("From: "+srcSquare[i]+" to "+srcSquare[i+1]+". Expected to go: "+dstSquare[i]+", "+dstSquare[i+1]+ ". Went to: "+a+", "+c);
     }
     console.log(H);
     */
     return H;

}


function containsValueGreaterThan(iterable, value){
    for (let i=0; i<iterable.length; i++){
        if (iterable[i] > value){
            return true
        }
    }
    return false
}

function minmaxXYofArray(array, rounded = true){
    let maxX = -10000;
    let maxY = -10000;
    let minX = 10000;
    let minY = 10000;
    for (let i=0; i<array.length; i++){
        const element = array[i];
        if ((i%2) === 0){
            if(element > maxX){
                maxX = element;
            } 
            if(element < minX){
                minX = element;
            }
        } else {
            if(element > maxY){
                maxY = element;
            } 
            if(element < minY){
                minY = element;
            }
        }
    }
    if(rounded){
        return [Math.round(minX), Math.round(minY), Math.round(maxX), Math.round(maxY)];
    } else {
        return [minX, minY, maxX, maxY];
    }
}

function denormalizePoints(points, width, height){
    for (let i = 0; i < points.length; i++){
        points[i] = (i%2) === 0? points[i]*width : points[i]*height;
    }
}

function normalizePoints(points, width, height){
    for (let i = 0; i < points.length; i++){
        points[i] = (i%2) === 0? points[i]/width : points[i]/height;
    }
}

  // ------------------------------------ THIRD PARTY ---------------------------------------------

  // ------------------------------------ Numeric.js ---- https://github.com/sloisel/numeric ------
  /*
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
  */
 
  function clone(A,k,n) {
    if(typeof k === "undefined") { k=0; }
    if(typeof n === "undefined") { n = 1;}//numeric.sdim(A).length; }
    var i,ret = Array(A.length);
    if(k === n-1) {
        for(i in A) { if(A.hasOwnProperty(i)) ret[i] = A[i]; }
        return ret;
    }
    for(i in A) {
        if(A.hasOwnProperty(i)) ret[i] = clone(A[i],k+1,n);
    }
    return ret;
}
function LUsolve(LUP, b) {
    var i, j;
    var LU = LUP.LU;
    var n   = LU.length;
    var x = clone(b);
    var P   = LUP.P;
    var Pi, LUi, LUii, tmp;
  
    for (i=n-1;i!==-1;--i) x[i] = b[i];
    for (i = 0; i < n; ++i) {
      Pi = P[i];
      if (P[i] !== i) {
        tmp = x[i];
        x[i] = x[Pi];
        x[Pi] = tmp;
      }
  
      LUi = LU[i];
      for (j = 0; j < i; ++j) {
        x[i] -= x[j] * LUi[j];
      }
    }
  
    for (i = n - 1; i >= 0; --i) {
      LUi = LU[i];
      for (j = i + 1; j < n; ++j) {
        x[i] -= x[j] * LUi[j];
      }
  
      x[i] /= LUi[i];
    }
  
    return x;
  }

  function LU(A, fast) {
    fast = fast || false;
  
    var abs = Math.abs;
    var i, j, k, absAjk, Akk, Ak, Pk, Ai;
    var max;
    var n = A.length, n1 = n-1;
    var P = new Array(n);
    if(!fast) A = clone(A);
  
    for (k = 0; k < n; ++k) {
      Pk = k;
      Ak = A[k];
      max = abs(Ak[k]);
      for (j = k + 1; j < n; ++j) {
        absAjk = abs(A[j][k]);
        if (max < absAjk) {
          max = absAjk;
          Pk = j;
        }
      }
      P[k] = Pk;
  
      if (Pk != k) {
        A[k] = A[Pk];
        A[Pk] = Ak;
        Ak = A[k];
      }
  
      Akk = Ak[k];
  
      for (i = k + 1; i < n; ++i) {
        A[i][k] /= Akk;
      }
  
      for (i = k + 1; i < n; ++i) {
        Ai = A[i];
        for (j = k + 1; j < n1; ++j) {
          Ai[j] -= Ai[k] * Ak[j];
          ++j;
          Ai[j] -= Ai[k] * Ak[j];
        }
        if(j===n1) Ai[j] -= Ai[k] * Ak[j];
      }
    }
  
    return {
      LU: A,
      P:  P
    };
  }

function solve(A,b,fast) { return LUsolve(LU(A,fast), b); }