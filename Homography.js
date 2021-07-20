const availableTransforms = ['auto', 'piecewiseaffine', 'affine'];
const dims = 2;

class Homography {
    constructor(w=400, h=400, transform = 'piecewiseaffine'){
        this.w = w;
        this.h = h;
        this.firstTransformSelected = transform.toLowerCase();
        this.transform = transform.toLowerCase();
        this.hiddenCanvas = document.createElement('canvas');
        this.hiddenCanvas.width = w;
        this.hiddenCanvas.height = h;
        this.hiddenCanvas.style.display = 'hidden';
        this.hiddenCanvasContext = this.hiddenCanvas.getContext("2d");
        // Used to avoid new memory allocation
        this.auxSrcTriangle = new Int16Array(3*dims);
        this.auxDstTriangle = new Int16Array(3*dims);

    }

    setSourcePoints(points){
        //TODO: Currently, it does not accept normalized coordinates
        // If it is given as a list, transform it to an Int16Array for improving performance.
        if(!ArrayBuffer.isView(points)) points = new Int16Array(points.flat())
        this.srcPoints = points;
        this.checkAndSelectTransform();
        if (this.transform === 'piecewiseaffine'){
            this.build_triangles();
        }
        //this.piecewiseAffineTransform();
        //this.faceMeshMap.onload = this.onLoadMeshMap.bind(this, w, h);
    }
    /*
    reescalePoints(points, w=400, h=400){
        for (let i = 0; i<points.length; i++){
            points[i][0] *= w;
            points[i][1] *= h;
        }
        return points;
    }*/
    checkAndSelectTransform(){
        /**
         * Verifies that this.srcPoints is in accordance with the selected transform, or select one transform if 'auto' 
         */
        if (this.transform === 'auto'){
            if (this.srcPoints.length === 3*dims) this.transform = 'affine';
            else if (this.srcPoints.length > 3*dims) this.transform = 'piecewiseaffine';
            //TODO: Select best transform
        } else if (this.transform === 'piecewiseaffine'){
            // If it have only 3 points it is an affine transform.
            if (this.srcPoints.length === 3*dims){
                this.transform = 'affine';
                console.warn('Only 3 source points given but "piecewiseAffine" transform selected. Transform changed to "affine".');
            } else if (this.srcPoints.length < 3*dims){
                throw(`A piecewise (or affine) transform needs to determine least three reference points but only ${this.srcPoints.length/dims} were given`);
            }
        } else if (this.transform === 'affine'){
            if (this.srcPoints.length !== 3*dims){
                throw(`An affine transform needs to determine exactly three reference points but ${this.srcPoints.length/dims} were given`)
            }
        }
    }
    build_triangles(){
        this.triangles = Delaunay(this.srcPoints);
        this.trianglesCorrespondencesMatrix = this.buildTrianglesCorrespondencesMatrix();
    }

    setDstPoints(dstPoints){
        if (this.transform === 'piecewiseaffine') this.piecewiseMatrices = this.piecewiseAffineTransform(dstPoints.flat());
        
    }

    piecewiseAffineTransform(dstPoints){
        let piecewiseMatrices = []
        for(const triangle of this.triangles){
            // Set in the already allocated memory for doing it faster and keep it as an Int16Array (It would be nice to check other options (including async function))
            //Set the srcTriangle
            this.auxSrcTriangle[0] = this.srcPoints[triangle[0]*dims]; this.auxSrcTriangle[1] = this.srcPoints[triangle[0]*dims+1];
            this.auxSrcTriangle[2] = this.srcPoints[triangle[1]*dims]; this.auxSrcTriangle[3] = this.srcPoints[triangle[1]*dims+1];
            this.auxSrcTriangle[4] = this.srcPoints[triangle[2]*dims]; this.auxSrcTriangle[5] = this.srcPoints[triangle[2]*dims+1];
            //Set the dstTriangle
            this.auxDstTriangle[0] = dstPoints[triangle[0]*dims]; this.auxDstTriangle[1] = dstPoints[triangle[0]*dims+1];
            this.auxDstTriangle[2] = dstPoints[triangle[1]*dims]; this.auxDstTriangle[3] = dstPoints[triangle[1]*dims+1];
            this.auxDstTriangle[4] = dstPoints[triangle[2]*dims]; this.auxDstTriangle[5] = dstPoints[triangle[2]*dims+1];
            
            piecewiseMatrices.push(affineMatrixFromTriangles(this.auxSrcTriangle, this.auxDstTriangle))
        }
        return piecewiseMatrices;
    }

    onLoadMeshMap(w, h){
        this.coords_map = this.buildTrianglesCorrespondencesMatrix();
        this.warp(this.faceMeshMap);
    }

    warp(image){
        const rgba_size = 4;
        image = this.getImageAsRGBAArray(image);
        let output_img = new Uint8ClampedArray(image.length).fill(0); //Change to set as the image after debugging
        for (let h = 0; h < this.h; h++){
            for (let w = 0; w < this.w; w++){
                const inTriangle = this.trianglesCorrespondencesMatrix[h*this.w+w]
                if (inTriangle > -1){
                    const idx = h*this.w*rgba_size+w*rgba_size;
                    let [newX, newY] = applyTransformToPoint(this.piecewiseMatrices[inTriangle], w, h);//TransformationMatrix.applyToPoint(this.piecewiseMatrices[inTriangle], [w, h]);
                    newX = Math.round(newX); newY = Math.round(newY);
                    const newIdx = newY*this.w*rgba_size+newX*rgba_size;
                    output_img[newIdx] = image[idx], output_img[newIdx+1] = image[idx+1], output_img[newIdx+2] = image[idx+2], output_img[newIdx+3] = 255; 
                }
            }     
        } 
        return output_img;
    }

    buildTrianglesCorrespondencesMatrix(method='circumscribed'){
        // TODO: TIME SPENT IS HEREEE! Solve it;
        this.trianglesCorrespondencesMatrix = new Int16Array(this.w* this.h).fill(-1);
        switch(method){
            case 'floodFill':
                for (const [i, triangle] of Object.entries(this.triangles)){
                    this.auxSrcTriangle[0] = this.srcPoints[triangle[0]*dims]; this.auxSrcTriangle[1] = this.srcPoints[triangle[0]*dims+1];
                    this.auxSrcTriangle[2] = this.srcPoints[triangle[1]*dims]; this.auxSrcTriangle[3] = this.srcPoints[triangle[1]*dims+1];
                    this.auxSrcTriangle[4] = this.srcPoints[triangle[2]*dims]; this.auxSrcTriangle[5] = this.srcPoints[triangle[2]*dims+1];
                    this.fillByFloodFill(this.auxSrcTriangle, i)
                }
                break;
            case 'circumscribed':
                for (const [i, triangle] of Object.entries(this.triangles)){
                    //Set the srcTriangle
                    this.auxSrcTriangle[0] = this.srcPoints[triangle[0]*dims]; this.auxSrcTriangle[1] = this.srcPoints[triangle[0]*dims+1];
                    this.auxSrcTriangle[2] = this.srcPoints[triangle[1]*dims]; this.auxSrcTriangle[3] = this.srcPoints[triangle[1]*dims+1];
                    this.auxSrcTriangle[4] = this.srcPoints[triangle[2]*dims]; this.auxSrcTriangle[5] = this.srcPoints[triangle[2]*dims+1];
                    this.fillByCircumscribedRectangle(this.auxSrcTriangle, i);
                }
                break;
        }
        
        /*
        let asMatrix = [];
        for(let h = 0; h < this.h; h++){
            let row = [];
            for(let w = 0; w < this.w; w++){
                row.push(this.trianglesCorrespondencesMatrix[h*this.w+w])
            }
            asMatrix.push(row)
        }

        console.table(asMatrix);*/
    
       return this.trianglesCorrespondencesMatrix;
    }

    getImageAsRGBAArray(image){
        this.hiddenCanvasContext.clearRect(0, 0, this.w, this.h);
        this.hiddenCanvasContext.drawImage(image, 0, 0, this.w, this.h); //image.width, image.height);
        const imageRGBA = this.hiddenCanvasContext.getImageData(0, 0, this.w, this.h);
        return imageRGBA.data;
    }
    
    getImageFromRGBAArray(array){// Obtain a blob: URL for the image data.
        const imgData = new ImageData(array, this.w, this.h);
        this.hiddenCanvasContext.clearRect(0, 0, this.w, this.h);
        this.hiddenCanvasContext.putImageData(imgData, 0, 0);
        let img = document.createElement('img')
        img.src = this.hiddenCanvas.toDataURL();
        return img;
    }

    fillByCircumscribedRectangle(triangle, idx){
        const rectangle = rectangleCircunscribingTriangle(triangle);
        for (let x = rectangle.x; x < rectangle.width; x++){
            for (let y = rectangle.y; y < rectangle.height; y++){
                if (pointInTriangle(x, y, triangle)){
                    this.trianglesCorrespondencesMatrix[y * this.w + x] = idx;
                }
            }
        }
    }

    fillByFloodFill(triangle, idx){
        const point = [Math.round(triangle[0]), Math.round(triangle[1])];
        if (point[0] == this.w) point[0]-=1;
        if (point[1] == this.h) point[1]-=1;
        this.trianglesCorrespondencesMatrix[point[0]*this.w+point[1]] = idx;
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
        const index = point[0]*this.w+point[1];
        if(this.trianglesCorrespondencesMatrix[index] < 0 && 
            pointInTriangle(point[0], point[1], triangle)){
            this.trianglesCorrespondencesMatrix[index] = idx;
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