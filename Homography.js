

class Homography {
    constructor(w=400, h=400){
        this.w = w;
        this.h = h;
        this.hiddenCanvas = document.createElement('canvas');
        this.hiddenCanvas.width = w;
        this.hiddenCanvas.height = h;
        this.hiddenCanvas.style.display = 'hidden';
        this.hiddenCanvasContext = this.hiddenCanvas.getContext("2d");
        this.piecewiseMatrices = null;

    }

    setSourcePoints(points, reescale = false){
        this.srcPoints = reescale? this.reescalePoints(points, this.w, this.h) : points;
        this.triangles = null;
        this.build_triangles();

        //this.piecewiseAffineTransform();
        //this.faceMeshMap.onload = this.onLoadMeshMap.bind(this, w, h);
    }

    reescalePoints(points, w=400, h=400){
        for (let i = 0; i<points.length; i++){
            points[i][0] *= w;
            points[i][1] *= h;
        }
        return points;
    }

    build_triangles(){
        this.triangles = Delaunay(this.srcPoints);
        this.trianglesCorrespondencesMatrix = this.buildTrianglesCorrespondencesMatrix();
    }

    piecewiseAffineTransform(dstPoints, reescale = false){
        dstPoints = reescale? this.reescalePoints(dstPoints, this.w, this.h) : dstPoints;
        let piecewiseMatrices = []
        for(const triangle of this.triangles){
            const srcTriangle = [this.srcPoints[triangle[0]], this.srcPoints[triangle[1]], this.srcPoints[triangle[2]]];
            const dstTriangle = [dstPoints[triangle[0]], dstPoints[triangle[1]], dstPoints[triangle[2]]];
            piecewiseMatrices.push(TransformationMatrix.fromTriangles(srcTriangle, dstTriangle))
        }
        this.piecewiseMatrices = piecewiseMatrices;
    }

    onLoadMeshMap(w, h){
        this.coords_map = this.buildTrianglesCorrespondencesMatrix();
        this.warp(this.faceMeshMap);
    }

    warp(image){
        const rgba_size = 4;
        image = this.getImageAsRGBAArray(image);
        let output_img = new Uint8ClampedArray(image.length).fill(0); //Change to set as the image after debugging
        console.log(output_img)
        for (let h = 0; h < this.h; h++){
            for (let w = 0; w < this.w; w++){
                const inTriangle = this.trianglesCorrespondencesMatrix[h*this.w+w]
                if (inTriangle > -1){
                    const idx = h*this.w*rgba_size+w*rgba_size;
                    let [newX, newY] = TransformationMatrix.applyToPoint(this.piecewiseMatrices[inTriangle], [w, h]);
                    newX = Math.round(newX); newY = Math.round(newY);
                    const newIdx = newY*this.w*rgba_size+newX*rgba_size;
                    output_img[newIdx] = image[idx], output_img[newIdx+1] = image[idx+1], output_img[newIdx+2] = image[idx+2], output_img[newIdx+3] = 255; 
                }
            }     
        } 
        return output_img;
    }

    buildTrianglesCorrespondencesMatrix(method='floodFill'){
        this.trianglesCorrespondencesMatrix = new Int16Array(this.w* this.h).fill(-1);
        //TODO: Solve bug, circumscribed version allows to go to h, w while floodFill must be configured to h-1, w-1
        switch(method){
            case 'floodFill':
                for (const [i, triangle] of Object.entries(this.triangles)){
                    const srcTriangle = [this.srcPoints[triangle[0]], this.srcPoints[triangle[1]], this.srcPoints[triangle[2]]];
                    this.fillByFloodFill(srcTriangle, i)
                }
                break;
            case 'circumscribed':
                for (const [i, triangle] of Object.entries(this.triangles)){
                    const srcTriangle = [this.srcPoints[triangle[0]], this.srcPoints[triangle[1]], this.srcPoints[triangle[2]]];
                    this.fillByCircumscribedRectangle(srcTriangle, i);
                    console.log("FILLED")
                }
                break;
        }
        

        let asMatrix = [];
        for(let h = 0; h < this.h; h++){
            let row = [];
            for(let w = 0; w < this.w; w++){
                row.push(this.trianglesCorrespondencesMatrix[h*this.w+w])
            }
            asMatrix.push(row)
        }

        console.table(asMatrix);
        
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
                if (pointInTriangle([x, y], triangle)){
                    this.trianglesCorrespondencesMatrix[y * this.w + x] = idx;
                }
            }
        }
    }

    fillByFloodFill(triangle, idx){
        const point = [Math.round(triangle[0][0]), Math.round(triangle[0][1])];

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
            pointInTriangle(point, triangle)){

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
    const triangles = new Delaunator(points.flat()).triangles;
    let triangles_idx = [];
    for (let i = 0; i < triangles.length; i += 3) {
        triangles_idx.push([triangles[i], triangles[i+1], triangles[i+2]]);
    }
    return triangles_idx;
}


//TODO: Understand and modify this (comes from https://github.com/mattdesl/point-in-triangle)
//http://www.blackpawn.com/texts/pointinpoly/
function pointInTriangle(point, triangle) {
    //compute vectors & dot products
    var cx = point[0], cy = point[1],
        t0 = triangle[0], t1 = triangle[1], t2 = triangle[2],
        v0x = t2[0]-t0[0], v0y = t2[1]-t0[1],
        v1x = t1[0]-t0[0], v1y = t1[1]-t0[1],
        v2x = cx-t0[0], v2y = cy-t0[1],
        dot00 = v0x*v0x + v0y*v0y,
        dot01 = v0x*v1x + v0y*v1y,
        dot02 = v0x*v2x + v0y*v2y,
        dot11 = v1x*v1x + v1y*v1y,
        dot12 = v1x*v2x + v1y*v2y

    // Compute barycentric coordinates
    var b = (dot00 * dot11 - dot01 * dot01),
        inv = b === 0 ? 0 : (1 / b),
        u = (dot11*dot02 - dot01*dot12) * inv,
        v = (dot00*dot12 - dot01*dot02) * inv
    return u>=0 && v>=0 && (u+v <= 1)
}

function rectangleCircunscribingTriangle(triangle){
    const x = Math.min(triangle[0][0], triangle[1][0], triangle[2][0]);
    const y = Math.min(triangle[0][1], triangle[1][1], triangle[2][1]);
    const width = Math.max(triangle[0][0], triangle[1][0], triangle[2][0])-x;
    const height =  Math.max(triangle[0][1], triangle[1][1], triangle[2][1])-y;
    return {x : Math.floor(x), y : Math.floor(y), width : Math.ceil(width), height : Math.ceil(height)};
}