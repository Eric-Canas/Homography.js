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
        this._srcPoints = null;
        this._dstPoints = null;
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
        // Check if it is given in normalized coordinates, if this information is not given.
        this._srcPointsAreNormalized = pointsAreNormalized === null? !containsValueGreaterThan(this._srcPoints, normalizedMax) : pointsAreNormalized;

        // Verifies if the selected transform is coherent with the points array given, or select the best one if 'auto' mode is selected.
        this.transform = checkAndSelectTransform(this.firstTransformSelected, this._srcPoints);

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
            this._piecewiseMatrices = null
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
        if (this._width === null || this._height === null)
            this._setSrcWidthHeight((width === null? image.width : width), (height === null? image.height : height));
        
        // Sets the image as a flat Uint8ClampedArray, for dealing fast with it. It will also resize the image if needed.
        this._HTMLImage = image;
        this._image = this._getImageAsRGBAArray(image);
        
        // If destiny points are already set but objectiveWidth and objectiveHeight are not, set them now.
        if (this._dstPoints !== null && (this._objectiveWidth <= 0 || this._objectiveHeight <= 0)){
            this._induceBestObjectiveWidthAndHeight();
        }

        // If source points are already set, now it is possible to calculate the "piecewiseaffine" parameters if needed.
        if(this._srcPoints !== null && this.transform === 'piecewiseaffine'){
            // Calculate all the auxiliar parameters that can be already calculated
            this._setPiecewiseAffineTransformParameters();
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
        if (this._image !== null || !this._dstPointsAreNormalized || (this.transform === 'piecewiseaffine' && this._width > 0 && this._height > 0)){
            this._induceBestObjectiveWidthAndHeight();
            if (this._hiddenCanvas.width < this._objectiveWidth) {this._hiddenCanvas.width = this._objectiveWidth;}
            if (this._hiddenCanvas.height < this._objectiveHeight) {this._hiddenCanvas.height = this._objectiveHeight;} 
        }
        
        // If Piecewise Affine transform were selected and there is enough information, calculate all the auxiliar structures
        if (this.transform === 'piecewiseaffine' && this._objectiveWidth > 0 && this._objectiveHeight > 0){
            // Transform the points to image coordinates if normalized coordinates were given
            if (this._dstPointsAreNormalized){
                denormalizePoints(this._dstPoints, this._objectiveWidth, this._objectiveHeight);
                this._dstPointsAreNormalized = false;
            }
            // Set the parameters piecewise affine parameters that can be already set
            this._setPiecewiseAffineTransformParameters();
        }
        
    }

    /* ----------------------------------------------- PRIVATE FUNCTIONS -------------------------------------------------- */
    /* --------------------------------- These functions should not be used by the user ----------------------------------- */
    
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
            // TODO: Check the case where this information can be inferred from the piecewiseMatrices. Maybe dividing this._dstPoints max between the input
            this._xOutputOffset = null;
            this._yOutputOffset = null;
            [ , , this._objectiveWidth, this._objectiveHeight] = minmaxXYofArray(this._dstPoints);
        
        // If piecewise transform is selected and dstPoints are normalized, set the output width and height as the input, since it is the best it can do.
        } else {
            /*console.warn("Array of destiny points is normalized, but width and height parameters are not given. "+
                         "Width and Height of the source will be used but it could be undesired in some cases.");*/
            this._objectiveWidth = this._width;
            this._objectiveHeight = this._height;       
        }

        // Finally modify the hidden canvas width and height if needed
        if (this._hiddenCanvas.width < this._objectiveWidth) {this._hiddenCanvas.width = this._objectiveWidth;}
        if (this._hiddenCanvas.height < this._objectiveHeight) {this._hiddenCanvas.height = this._objectiveHeight;}
    }

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
                this._trianglesCorrespondencesMatrix = this.buildTrianglesCorrespondencesMatrix();
            }

            // If destiny points are known (as well as source points), build also the transformation matrices if they did not exist.
            // NOTE that it forces to unset piecewiseMatrices (set as null) when source points or destiny points are modified.
            if(this._dstPoints !== null && this._piecewiseMatrices === null && this._triangles !== null){
                if(this._dstPointsAreNormalized){
                    // Ensure that objectiveWidth and objectiveHeight are set before to use them.
                    if (this._objectiveWidth <= 0 || this._objectiveHeight <= 0){ 
                        this._induceBestObjectiveWidthAndHeight();
                    }
                    // Denormalize dstPoints for putting them in the same range than srcPoints
                    denormalizePoints(this._dstPoints, this._objectiveWidth, this._objectiveHeight);
                    this._dstPointsAreNormalized = false;
                }
                this._piecewiseMatrices = this._calculatePiecewiseAffineTransformMatrices();
            }
        } else {
            throw("Trying to set the Piecewise Affine Transform parameters before setting the Source Points.")
        }
    }

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

    /**
     * Apply the calculated homography to the given image. If no image is passed to the function and it was setted before the call of warp (recommended
     * for performance reasons) warps the pre-setted image. In case that image is given it will be internally setted, so any future call to warp() receiving
     * no parameters will apply the transformation over this image again (It will be usually useful when the same image is being constantly adapted to, for example,
     * detections coming from a video stream).
     * 
     * @param {HTMLImageElement}  [image]  Image that will transformed. If this parameter is not given since image was previously setted through `setImage(img)` or
     *                                     `setSrcPoints(points, img)`, this previously setted image will be the one that will be warped. If an image is given,
     *                                      it will be internally setted, so any future call to warp for transforming the same image could avoid to pass this image
     *                                      parameter again. This reuse of the image, if applicable, would speed up the transformation.
     * 
     * @return {ImageData}        Transformed image in format ImageData. It can be directly drawn in a canvas by using context.putImageData(img, x, y). For converting
     *                            it to HTMLImageElement you can use HTMLImageElementFromImageData(img) (please note that  HTMLImageElementFromImageData(img) returns
     *                            a promise).
     */

    warp(image = null){
        if (image !== null){
            this.setImage(image);
        } else if (this._image === null){
            throw("warp() must receive an image if it was not setted before through `setImage(img)` or  `setSrcPoints(points, img)`");
        }
        let output_img;
        switch(this.transform){
            case 'piecewiseaffine':
                output_img = this._piecewiseAffineWarp(this._image);
                break;
            case 'affine':
            case 'projective':
                if (this._objectiveWidth > this._width || this._objectiveHeight > this._height){
                    output_img = this._inverseSimpleWarp(this._image);
                } else {
                    output_img = this._simpleWarp(this._image);
                }
                break;
        }
        output_img = new ImageData(output_img, this._objectiveWidth, this._objectiveHeight);
        return output_img;
    }

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
                    newX = Math.round(newX); newY = Math.round(newY);
                    //Get the index of y, x coordinate in the output image ArrayBuffer (binary shift (<<2) is a faster version of *4)
                    const newIdx = (newY*dstRowLenght)+(newX<<2);
                    
                    output_img[newIdx] = image[idx], output_img[newIdx+1] = image[idx+1],
                    output_img[newIdx+2] = image[idx+2], output_img[newIdx+3] = image[idx+3]; 
                // TODO: ERASE IT AFTER DEBUGGING
                } else {
                    const newIdx = (y*this._objectiveWidth<<4)+(x<<4);
                    output_img[newIdx] = 255, output_img[newIdx+1] = 0,
                    output_img[newIdx+2] = 0, output_img[newIdx+3] = 255; 
                }
            }    
        }    
        return output_img;
    }

    _simpleWarp(image){
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

    _inverseSimpleWarp(image){
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
                        //Get the index in the source domain
                        srcX = Math.round(srcX); srcY = Math.round(srcY);
                        //Get the index of y, x coordinate in the output image ArrayBuffer
                        const srcIdx = (srcY*srcRowLenght)+(srcX<<2);
                        output_img[idx] = image[srcIdx], output_img[idx+1] = image[srcIdx+1],
                        output_img[idx+2] = image[srcIdx+2], output_img[idx+3] = image[srcIdx+3];
                    }
                    // Anything outside it is kept as transparent background
            }    
        }    
        return output_img;
    }

     
    // TODO: Improve how the pads works here
    buildTrianglesCorrespondencesMatrix(method='circumscribed'){
        // TODO: TIME SPENT IS HEREEE! Think about a better method 
        this._trianglesCorrespondencesMatrix = new Int16Array((this._maxSrcX-this._minSrcX)*(this._maxSrcY - this._minSrcY)).fill(-1);
        switch(method){
            case 'floodFill':
                for (const [i, triangle] of Object.entries(this._triangles)){
                    this._auxSrcTriangle[0] = this._srcPoints[triangle[0]*dims]; this._auxSrcTriangle[1] = this._srcPoints[triangle[0]*dims+1];
                    this._auxSrcTriangle[2] = this._srcPoints[triangle[1]*dims]; this._auxSrcTriangle[3] = this._srcPoints[triangle[1]*dims+1];
                    this._auxSrcTriangle[4] = this._srcPoints[triangle[2]*dims]; this._auxSrcTriangle[5] = this._srcPoints[triangle[2]*dims+1];
                    this.fillByFloodFill(this._auxSrcTriangle, i)
                }
                break;
            case 'circumscribed':
                for (const [i, triangle] of Object.entries(this._triangles)){
                    //Set the srcTriangle
                    this._auxSrcTriangle[0] = this._srcPoints[triangle[0]*dims]; this._auxSrcTriangle[1] = this._srcPoints[triangle[0]*dims+1];
                    this._auxSrcTriangle[2] = this._srcPoints[triangle[1]*dims]; this._auxSrcTriangle[3] = this._srcPoints[triangle[1]*dims+1];
                    this._auxSrcTriangle[4] = this._srcPoints[triangle[2]*dims]; this._auxSrcTriangle[5] = this._srcPoints[triangle[2]*dims+1];
                    this.fillByCircumscribedRectangle(this._auxSrcTriangle, i);
                }
                break;
        }
        
        /*
        let asMatrix = [];
        for(let h = 0; h < this._h; h++){
            let row = [];
            for(let w = 0; w < this._w; w++){
                row.push(this._trianglesCorrespondencesMatrix[h*this._w+w])
            }
            asMatrix.push(row)
        }
        console.table(asMatrix);*/
       return this._trianglesCorrespondencesMatrix;
    }

    _getImageAsRGBAArray(image){
        this._hiddenCanvasContext.clearRect(0, 0, this._width, this._height);
        this._hiddenCanvasContext.drawImage(image, 0, 0, this._width, this._height); //image.width, image.height);
        const imageRGBA = this._hiddenCanvasContext.getImageData(0, 0, this._width, this._height);
        return imageRGBA.data;
    }
    
    async HTMLImageElementFromImageData(imgData, asPromise = true){// Obtain a blob: URL for the image data.
        this._hiddenCanvasContext.clearRect(0, 0, this._width, this._height);
        this._hiddenCanvasContext.putImageData(imgData, 0, 0);
        let img = document.createElement('img')
        img.src = this._hiddenCanvas.toDataURL();
        //document.body.append(img);
        if (asPromise){
            return new Promise((resolve, reject) => {
                img.onload = () => resolve(img);
                img.onerror = reject;
            });
        } else {
            return img;
        }
    }

    fillByCircumscribedRectangle(triangle, idx){
        const rectangle = rectangleCircunscribingTriangle(triangle);
        //Set the the width to manage the offset of the matrix
        const trianglesCorrespondencesMatrixWidth = this._maxSrcX-this._minSrcX;
        for (let y = rectangle.y; y < rectangle.y+rectangle.height; y++){
            for (let x = rectangle.x; x < rectangle.x+rectangle.width; x++){
                if (pointInTriangle(x, y, triangle)){
                    this._trianglesCorrespondencesMatrix[(y-this._minSrcY) * trianglesCorrespondencesMatrixWidth + (x-this._minSrcX)] = idx;
                }
            }
        }
    }

    fillByFloodFill(triangle, idx){
        const point = [Math.round(triangle[0]), Math.round(triangle[1])];
        if (point[0] == this._width) point[0]-=1;
        if (point[1] == this._height) point[1]-=1;
        this._trianglesCorrespondencesMatrix[point[0]*this._width+point[1]] = idx;
        // North
        this.floodFill(triangle, [point[0], point[1]-1], idx);
        // South
        this.floodFill(triangle, [point[0], point[1]+1], idx);
        // West
        this.floodFill(triangle, [point[0]-1, point[1]], idx);
        // East
        this.floodFill(triangle, [point[0]+1, point[1]], idx);
    }

    floodFill(triangle, point, idx){
        const index = point[0]*this._width+point[1];
        if(this._trianglesCorrespondencesMatrix[index] < 0 && 
            pointInTriangle(point[0], point[1], triangle)){
            this._trianglesCorrespondencesMatrix[index] = idx;
             // North
            this.floodFill(triangle, [point[0], point[1]-1], idx);
            // South
            this.floodFill(triangle, [point[0], point[1]+1], idx);
            // West
            this.floodFill(triangle, [point[0]-1, point[1]], idx);
            // East
            this.floodFill(triangle, [point[0]+1, point[1]], idx);
        }
    }

}
export {Homography}

function Delaunay(points){
    /*Import library from <script src="https://unpkg.com/delaunator@5.0.0/delaunator.min.js"></script>*/
    const triangles = new Delaunator(points).triangles;
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

//This code is slightly adapted from (https://github.com/mattdesl/point-in-triangle [http://www.blackpawn.com/texts/pointinpoly/])
function pointInTriangle(x, y, triangle) {

    //compute vectors & dot products
    const v0x = triangle[4]-triangle[0], v0y = triangle[5]-triangle[1],
        v1x = triangle[2]-triangle[0], v1y = triangle[3]-triangle[1],
        v2x = x-triangle[0], v2y = y-triangle[1],
        dot00 = v0x*v0x + v0y*v0y,
        dot01 = v0x*v1x + v0y*v1y,
        dot02 = v0x*v2x + v0y*v2y,
        dot11 = v1x*v1x + v1y*v1y,
        dot12 = v1x*v2x + v1y*v2y

    // Compute barycentric coordinates
    const b = (dot00 * dot11 - dot01 * dot01),
        inv = b === 0 ? 0 : (1 / b),
        u = (dot11*dot02 - dot01*dot12) * inv,
        v = (dot00*dot12 - dot01*dot02) * inv
    return u>=0 && v>=0 && (u+v < 1)
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

function rectangleCircunscribingTriangle(triangle){
    const x = Math.min(triangle[0], triangle[2], triangle[4]);
    const y = Math.min(triangle[1], triangle[3], triangle[5]);
    const width = Math.max(triangle[0], triangle[2], triangle[4])-x;
    const height =  Math.max(triangle[1], triangle[3], triangle[5])-y;
    return {x : Math.floor(x), y : Math.floor(y), width : Math.ceil(width), height : Math.ceil(height)};
}

function containsValueGreaterThan(iterable, value){
    for (let i=0; i<iterable.length; i++){
        if (iterable[i] > value){
            return true
        }
    }
    return false
}

function minmaxXYofArray(array){
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
    return [Math.round(minX), Math.round(minY), Math.round(maxX), Math.round(maxY)];
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


  // --------------------- THIRD PARTY ----------------------------------

  // --------------------- Numeric.js -----------------------------------
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
 
