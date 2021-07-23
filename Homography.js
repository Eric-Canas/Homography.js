const availableTransforms = ['auto', 'piecewiseaffine', 'affine'];
const dims = 2;

class Homography {
    constructor(w=null, h=null, transform = 'piecewiseaffine'){
        if (w !== null) w = Math.round(w);
        if (h !== null) h = Math.round(h);
        // Width and Height refers to the input image. If width and height are given it will be resized.
        this._w = w;
        this._h = h;
        this._objectiveW = null;
        this._objectiveH = null;
        this._srcPointsAreNormalized = true;
        this._maxSrcX = null;
        this._maxSrcY = null;
        this._minSrcX = null;
        this._minSrcY = null;
        this.firstTransformSelected = transform.toLowerCase();
        this.transform = transform.toLowerCase();
        this._hiddenCanvas = document.createElement('canvas');
        this._hiddenCanvas.width = w;
        this._hiddenCanvas.height = h;
        this._hiddenCanvas.style.display = 'hidden';
        this._hiddenCanvasContext = this._hiddenCanvas.getContext("2d");
        this._srcPoints = null;
        this._dstPoints = null;
        // Used to avoid new memory allocation
        this._auxSrcTriangle = new Int16Array(3*dims);
        this._auxDstTriangle = new Int16Array(3*dims);
        this._HTMLImage = null;
        this._image = null;
        this._trianglesCorrespondencesMatrix = null;

    }
    /**
     * Set the source points ([[x1, y1], [x2, y2]]) of the transform and, optionally, the image that will be transformed.
     * 
     * @param {ArrayBuffer | Array} points   Source points of the transform, given as a BufferArray or Array in the form [x1, y1, x2, y2...]
     *                                       or [[x1, y1], [x2, y2]...]. These source points should be declared in image coordinates, (x : [0, width],
     *                                       y : [0, height]) or in normalized coordinates (x : [0.0, 1.0], y : [0.0, 1.0]);
     * @param {HTMLImageElement}    [image]  Optional source image, that will be warped later. Setting this element here will improve the
     *                                       warping performance when it is planned to apply multiple transformations (same source points
     *                                       different destiny points) to the same image, specially when source image have a transparent background.
     * @param {Number}              [width]  Only applied if image parameter is provided. Internally resizes the image to the given width. If not provided,
     *                                       original image width will be used (widths lowers than the original image will improve speed at cost of resolution).
     * @param {Number}              [height] Only applied if image parameter is provided. Internally resizes the image to the given height. If not provided,
     *                                       original image height will be used (heights lowers than the original image will improve speed at cost of resolution).
     */
    setSourcePoints(points, image = null, width = null, height = null){
        // If it is given as a list, transform it to an Int16Array for improving performance.
        if(!ArrayBuffer.isView(points)) points = new Int16Array(points.flat())
        this._srcPoints = points;
        this._srcPointsAreNormalized = !containsValueGreaterThan(this._srcPoints, 1.0);

        // Verifies if the selected transform is coherent with the srcPoints given, or select the best one if 'auto' is selected.
        this.transform = checkAndSelectTransform(this.firstTransformSelected, this._srcPoints);

        // Set the image if given
        if (image !== null){
            this.setImage(image, width, height);
        // In case that there were no image given but height and width, apply it.
        } else if (width !== null || height !== null){
            this.setSrcWidthHeight(width, height);
        }

        if (this.transform === 'piecewiseaffine' && !this._srcPointsAreNormalized && this._trianglesCorrespondencesMatrix === null){
            this.setAffineTransformParameters();
        }
    }

    /**
     * Set the image that will be transformed later. Internally, it implies that the source points will be rescaled to the new image shape
     * in case that they were given as normalized.
     * 
     * @param {HTMLImageElement}  image    Image that will internally saved for future warping. Although it is not necessary to be priorly setted,
     *                                     setting it from the very beginning will improve the performance of future steps, specially when multiple
     *                                     warpings will be applied to the same image.
     * @param {Number}            [width]  Optional width. Resizes the image to the given width. If not provided, original image width will be used
     *                                     (widths lowers than the original image width will improve speed at cost of resolution).
     * @param {Number}            [height] Optional height. Resizes the image to the given height. If not provided, original image height will be used
     *                                     (heights lowers than the original image height will improve speed at cost of resolution).
     */
    setImage(image, width = null, height = null){
        // Set the current width and height of the image
        if (this._w === null || this._h === null)
            this.setSrcWidthHeight((width === null? image.width : width), (height === null? image.height : height));
        this._HTMLImage = image;
        this._image = this._getImageAsRGBAArray(image);
        // If source points are already set
        if(this._srcPoints !== null){
            // Transform to image coordinates if normalized coordinates were given
            if (this._srcPointsAreNormalized){
                denormalizePoints(this._srcPoints, this._w, this._h);
                this._srcPointsAreNormalized = false;
            }
            // If piecewiseaffine transform is (and sourcePoints are set) prepare the auxiliar matrices for this transform
            if (this.transform === 'piecewiseaffine' && this._trianglesCorrespondencesMatrix === null){
                this.setAffineTransformParameters();
            }
        }
    }

    setAffineTransformParameters(){
        // Set the maxSrcX and maxSrcY. By the program logic, if it happens it is ensured that it did not happen in setSourcePoints(points) function
        [this._minSrcX, this._minSrcY, this._maxSrcX, this._maxSrcY] = minmaxXYofArray(this._srcPoints);     
        this._build_triangles();
    }

    setSrcWidthHeight(width, height){
        const last_width = this._w;
        const last_height = this._h;
        this._w = width;
        this._h = height;
        if(last_width !== width || last_height !== height){
            width = Math.round(width);
            height = Math.round(height) 
            this._hiddenCanvas.width = width;
            this._hiddenCanvas.height = height; 
            if(this._srcPoints !== null && this._srcPointsAreNormalized){
                denormalizePoints(this._srcPoints, this._w, this._h);
                this._srcPointsAreNormalized = false;
                // If piecewiseaffine transform is (and sourcePoints are set) prepare the auxiliar matrices for this transform
                if (this.transform === 'piecewiseaffine' && this._trianglesCorrespondencesMatrix === null){
                    this.setAffineTransformParameters();
                }       
            }
            // Resize the image if necessary
            if(this._image !== null && this._HTMLImage !== null){
                this._image = this._getImageAsRGBAArray(this._HTMLImage);
            }
        }

    }

    /**
     * Only useful for Piecewise Affine transform. Defines a mesh of triangles connecting each trio of closest points and generates a matrix with the size of
     * this mesh defining to which of these triangles belongs each coordinate. 
     */
    _build_triangles(){
        // Generate the triangles from the Delaunay method
        this._triangles = Delaunay(this._srcPoints);
        // Calculate a matrix determining from which triangle comes each coordinate of the image.
        this._trianglesCorrespondencesMatrix = this.buildTrianglesCorrespondencesMatrix();
    }

    /**
     * Set the destiny points ([[x1, y1], [x2, y2]]). Internally, it means that the corresponding transform matrices are calculated. Slight performance
     * improvement comes when width and height parameters are given, but take into account that outputs widths greaters than the source width could 
     * imply artifacts in the output image (this problem will be solved in future updates).
     * 
     * @param {ArrayBuffer | Array} points   Destiny points of the transform, given as a BufferArray or Array in the form [x1, y1, x2, y2...]
     *                                       or [[x1, y1], [x2, y2]...]. These source points should be declared in image coordinates, (x : [0, width],
     *                                       y : [0, height]) or in normalized coordinates (x : [0.0, 1.0], y : [0.0, 1.0]);
     * @param {Number}              [width]  Optional width. Only used if normalized coords were given. Expected width of the output image, 
     *                                       if not given the maximum of the points array will be used as width.
     * @param {Number}              [height] Optional height. Only used if normalized coords were given. Expected height of the output image, 
     *                                       if not given the maximum of the points array will be used as height.
     */
    setDstPoints(points, width = null, height = null){
        // Transform it to a typed array for perfomance reasons
        if(!ArrayBuffer.isView(points)) points = new Int16Array(points.flat());
        // Verify that these points matches with the source points
        if(points.length !== this._srcPoints.length) 
            throw(`It must be the same amount of destiny points (${points.length/dims}) than source points (${this._srcPoints.length/dims})`);

        this._dstPoints = points;
        this._isDstArrayNormalized = !containsValueGreaterThan(this._dstPoints, 1.0);
        
        // Induce the width and height if not given. 
        if ((width === null || height === null)){
            // Improve this function
            this.induceBestObjectiveWidthAndHeight();
        // Or set them if given
        } else {
            this._objectiveW = Math.round(width);
            this._objectiveH = Math.round(height);
        }

        // Transform the points to image coordinates if normalized coordinates were given
        if (this._isDstArrayNormalized){
            denormalizePoints(this._dstPoints, this._objectiveW, this._objectiveH);
            this._isDstArrayNormalized = false;
        }

        // Apply the selected transformation
        if (this.transform === 'piecewiseaffine'){
             this.piecewiseMatrices = this._calculatePiecewiseAffineTransformMatrices(points);
        }
    }
    
    _calculatePiecewiseAffineTransformMatrices(dstPoints){
        let piecewiseMatrices = [];
        for(const triangle of this._triangles){
            // Set in the already allocated memory for doing it faster and keep it as an Int16Array (It would be nice to check other options (including async function))
            //Set the srcTriangle
            this._auxSrcTriangle[0] = this._srcPoints[triangle[0]*dims]; this._auxSrcTriangle[1] = this._srcPoints[triangle[0]*dims+1];
            this._auxSrcTriangle[2] = this._srcPoints[triangle[1]*dims]; this._auxSrcTriangle[3] = this._srcPoints[triangle[1]*dims+1];
            this._auxSrcTriangle[4] = this._srcPoints[triangle[2]*dims]; this._auxSrcTriangle[5] = this._srcPoints[triangle[2]*dims+1];
            //Set the dstTriangle
            this._auxDstTriangle[0] = dstPoints[triangle[0]*dims]; this._auxDstTriangle[1] = dstPoints[triangle[0]*dims+1];
            this._auxDstTriangle[2] = dstPoints[triangle[1]*dims]; this._auxDstTriangle[3] = dstPoints[triangle[1]*dims+1];
            this._auxDstTriangle[4] = dstPoints[triangle[2]*dims]; this._auxDstTriangle[5] = dstPoints[triangle[2]*dims+1];
            
            piecewiseMatrices.push(affineMatrixFromTriangles(this._auxSrcTriangle, this._auxDstTriangle))
        }
        return piecewiseMatrices;
    }

    induceBestObjectiveWidthAndHeight(){
        // TODO: Do it when this._w, and this._h are not setted
        // Or check for which would be the minimum and the maximum point of the transformed image
        if (this._isDstArrayNormalized){
            console.warn("Array of destiny points is normalized, but width and height parameters are not given. "+
                         "Width and Height of the source will be used but it could be undesired in some cases.");
            
            this._objectiveW = this._w;
            this._objectiveH = this._h;
        } else {
            [ , , this._objectiveW, this._objectiveH] = minmaxXYofArray(this._dstPoints);
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
                output_img = this._piecewiseAffineWarp(this._image)
        
        }
         
        return output_img;
    }

    _piecewiseAffineWarp(image){
        const triangleCorrespondenceMatrixWidth = this._maxSrcX-this._minSrcX;
        // output_img starts as a fully transparent image (the whole alpha channel is filled with 0.
        let output_img = new Uint8ClampedArray(image.length); //Change to set as the image after debugging
        //We only check the points that can be inside a tringle, as the rest of points will not be translated in a piecewise warping.
        
        for (let y = this._minSrcY; y < this._maxSrcY; y++){
            for (let x = this._minSrcX; x < this._maxSrcX; x++){
                const inTriangle = this._trianglesCorrespondencesMatrix[(y-this._minSrcY)*triangleCorrespondenceMatrixWidth+(x-this._minSrcX)]
                if (inTriangle > -1){
                    //Get the index of y, x coordinate in the source image ArrayBuffer
                    const idx = y*this._w*4+x*4;
                    let [newX, newY] = applyTransformToPoint(this.piecewiseMatrices[inTriangle], x, y);
                    newX = Math.round(newX); newY = Math.round(newY);
                    //Get the index of y, x coordinate in the output image ArrayBuffer
                    const newIdx = newY*this._objectiveW*4+newX*4;
                    output_img[newIdx] = image[idx], output_img[newIdx+1] = image[idx+1],
                    output_img[newIdx+2] = image[idx+2], output_img[newIdx+3] = image[idx+3]; 
                }
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
        console.table(asMatrix);
        console.log(asMatrix);*/
       return this._trianglesCorrespondencesMatrix;
    }

    _getImageAsRGBAArray(image){

        this._hiddenCanvasContext.clearRect(0, 0, this._w, this._h);
        this._hiddenCanvasContext.drawImage(image, 0, 0, this._w, this._h); //image.width, image.height);
        const imageRGBA = this._hiddenCanvasContext.getImageData(0, 0, this._w, this._h);
        return imageRGBA.data;
    }
    
    async HTMLImageElementFromImageData(array, asPromise = true){// Obtain a blob: URL for the image data.
        const imgData = new ImageData(array, this._w, this._h);
        this._hiddenCanvasContext.clearRect(0, 0, this._w, this._h);
        this._hiddenCanvasContext.putImageData(imgData, 0, 0);
        let img = document.createElement('img')
        img.src = this._hiddenCanvas.toDataURL();
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
        for (let x = rectangle.x; x < rectangle.width; x++){
            for (let y = rectangle.y; y < rectangle.height; y++){
                if (pointInTriangle(x, y, triangle)){
                    this._trianglesCorrespondencesMatrix[(y-this._minSrcY) * trianglesCorrespondencesMatrixWidth + (x-this._minSrcX)] = idx;
                }
            }
        }
    }

    fillByFloodFill(triangle, idx){
        const point = [Math.round(triangle[0]), Math.round(triangle[1])];
        if (point[0] == this._w) point[0]-=1;
        if (point[1] == this._h) point[1]-=1;
        this._trianglesCorrespondencesMatrix[point[0]*this._w+point[1]] = idx;
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
        const index = point[0]*this._w+point[1];
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

function checkAndSelectTransform(transform, points){
    /**
     * Verifies that this.srcPoints is in accordance with the selected transform, or select one transform if 'auto' 
     */
    if (transform === 'auto'){
        if (points.length === 3*dims) transform = 'affine';
        else if (points.length > 3*dims) transform = 'piecewiseaffine';
    } else if (transform === 'piecewiseaffine'){
        // If it have only 3 points it is an affine transform.
        if (points.length === 3*dims){
            transform = 'affine';
            console.warn('Only 3 source points given but "piecewiseAffine" transform selected. Transform changed to "affine".');
        } else if (points.length < 3*dims){
            throw(`A piecewise (or affine) transform needs to determine least three reference points but only ${points.length/dims} were given`);
        }
    } else if (transform === 'affine'){
        if (points.length !== 3*dims){
            throw(`An affine transform needs to determine exactly three reference points but ${points.length/dims} were given`)
        }
    }
    return transform;
}

function applyTransformToPoint(matrix, x, y){
    return [(matrix[0] * x) + (matrix[2] * y) + matrix[4], //x
            (matrix[1] * x) + (matrix[3] * y) + matrix[5]] //y
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
    return [minX, minY, maxX, maxY];
}

function denormalizePoints(points, width, height){
    for (let i = 0; i < points.length; i++){
        points[i] = (i%2) === 0? points[i]*width : points[i]*height;
    }
}
