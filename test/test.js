import {Homography} from '../Homography.js';

const w = 400, h = 400;
const padBetweenImgs = w/4;
// Charge testImg
let testImg = document.createElement('img');
testImg.src = './testImg.png'
testImg.onload = () => runTests();


function runTests(){
    addTitle("PieceWise Affine Transforms")
    test1();
    test2();
    test3();
    test4();
    test5();

    addTitle("Affine Transforms");
    test6();
    test7();
    test8();
    test9();

    addTitle("Projective Transforms");
    test10();
    test11();
    test12();
}

/**
 * 
 */
function test1(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    let canvasContext = createCanvasContext("Identity Transform")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("piecewiseaffine", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(squarePoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(squarePoints, canvasContext, 0, identityHomography._triangles);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();
                        drawPointsInCanvas(squarePoints, canvasContext, w+padBetweenImgs, identityHomography._triangles);}))
}

function test2(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const dstPoints = [[w/5, h/5], [0, h/2], [w, 0], [w*6/8, h*6/8]];
    let canvasContext = createCanvasContext("Transforming both triangles of the square")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    // Don't set the width and height from the beginning
    const identityHomography = new Homography("piecewiseaffine");
    // But sets it when source points
    identityHomography.setSourcePoints(squarePoints, null, w, h);
    // Don't set any objective width
    identityHomography.setDstPoints(dstPoints);
    // Sets the image jst before the warping
    identityHomography.setImage(testImg);
    // Call the warping without any image
    const result = identityHomography.warp();
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(squarePoints, canvasContext, 0, identityHomography._triangles);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();
                        drawPointsInCanvas(dstPoints, canvasContext, w+padBetweenImgs, identityHomography._triangles);}))
}


function test3(){
    
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const dstPoints = [[0, 0], [0, h/2], [w/2, 0], [w/6, h/12]];
    let canvasContext = createCanvasContext("Resize through dstPoints + Overlapping")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    // Don't set the width and height at any moment
    const identityHomography = new Homography("piecewiseaffine", w, h);
    // And sets the image togheter with
    identityHomography.setSourcePoints(squarePoints, testImg);
    // Don't set any width or height in any moment
    identityHomography.setDstPoints(dstPoints);
    // Call the warping without any image
    const result = identityHomography.warp();
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(squarePoints, canvasContext, 0, identityHomography._triangles);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();
                        drawPointsInCanvas(dstPoints, canvasContext, w+padBetweenImgs, identityHomography._triangles);}))
}

function test4(){
    let newW = w*1.5;
    let newH  = h/1.5;
    const rectanglePoints = [[0, 0], [0, newH], [newW, 0], [newW, newH]];
    const dstPoints = [[0, 0], [0, newH], [newW, 0], [newW*3/4, newH*3/4]];
    let canvasContext = createCanvasContext("Resizing the image to Non-square", newW, newH)
    canvasContext.drawImage(testImg, 0, 0, newW, newH);
    canvasContext.fill();
    const s0 = performance.now();
    // Set the width and height from the beginning
    const identityHomography = new Homography("piecewiseaffine", newW, newH);
    identityHomography.setSourcePoints(rectanglePoints);
    identityHomography.setImage(testImg)
    identityHomography.setDstPoints(dstPoints, newW, newH);
    const result = identityHomography.warp();
    
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();
    drawPointsInCanvas(rectanglePoints, canvasContext, 0, identityHomography._triangles);
    addSecondsToTitle((s1-s0)/1000)
    img.then(((img) => {canvasContext.drawImage(img, newW+padBetweenImgs, 0, newW, newH);
                        canvasContext.fill();
                        drawPointsInCanvas(dstPoints, canvasContext, newW+padBetweenImgs, identityHomography._triangles);}))
}

function test5(){
    let srcPoints = [];
    let dstPoints = [];
    const pointsInX = 20;
    const pointsInY = 10;
    const amplitude = 20;
    for (let y = 0; y <= h; y+=h/pointsInY){
        for (let x = 0; x <= w; x+=w/pointsInX){
            srcPoints.push([x, y]);
            dstPoints.push([x, amplitude+y+Math.sin((x*8)/Math.PI)*amplitude]);
        }    
    }
    let canvasContext = createCanvasContext("Sinus", w, h+amplitude*2)
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    // Don't set the width and height at any moment
    const identityHomography = new Homography("piecewiseaffine", w, h);
    // And sets the image togheter with
    identityHomography.setSourcePoints(srcPoints);
    // Don't set any width or height in any moment
    identityHomography.setDstPoints(dstPoints, w, h+amplitude*2);
    // Call the warping without any image
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();
    drawPointsInCanvas(srcPoints, canvasContext, 0, identityHomography._triangles, 4);
    addSecondsToTitle((s1-s0)/1000)
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h+amplitude*2);
                        canvasContext.fill();
                        drawPointsInCanvas(dstPoints, canvasContext, w+padBetweenImgs, identityHomography._triangles, 4);}))
}

function test6(){
    // Affine
    const squarePoints = [[0, 0], [0, h], [w, 0]];
    // It will be really a X, Y shift, as it keeps only the observable part, it will look like an identity
    const displacedPoints = [[0+100, 0+50], [0+100, h+50], [w+100, 0+50]];    
    let canvasContext = createCanvasContext("Identity Transform")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("affine", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(displacedPoints);
    const result = identityHomography.warp(testImg);
    console.log(result);
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    // Draw the src points again, as the translation should be virtually lost
    drawPointsInCanvas(squarePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h+50);
                        canvasContext.fill();
                        drawPointsInCanvas(squarePoints, canvasContext, w+padBetweenImgs);}))
}


function test7(){
    const squarePoints = [[0, 0], [0, h], [w, 0]];
    const rotatedPoints = [[0, h/2], [w/2, h], [w/2, 0]];
    let canvasContext = createCanvasContext("45 Degrees Rotation")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("affine", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(rotatedPoints);
    const result = identityHomography.warp(testImg);
    console.log(result)
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(squarePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();
                        drawPointsInCanvas(rotatedPoints, canvasContext, w+padBetweenImgs);}))
}

function test8(){
    // Affine
    const squarePoints = [[0, 0], [0, h], [w, 0]];
    const rectanglePoints = [[0, 0], [0, h*1.25], [w*1.75, 0]];    
    let canvasContext = createCanvasContext("Resize Transform", w*1.75, h*1.25)
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("affine", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(rectanglePoints);
    const result = identityHomography.warp(testImg);
    console.log(result)
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    // Draw the src points again, as the translation should be virtually lost
    drawPointsInCanvas(squarePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w*1.75, h*1.75);
                        canvasContext.fill();
                        drawPointsInCanvas(rectanglePoints, canvasContext, w+padBetweenImgs);}))
}

function test9(){
    // Affine
    const squarePoints = [[0, 0], [0, h], [w, 0]];
    const rectanglePoints = [[0, 0], [w, h], [w, h/5]];      
    let canvasContext = createCanvasContext("Complex Transform", w*2, h+h/5)
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("affine", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(rectanglePoints);
    const result = identityHomography.warp(testImg);
    console.log(result)
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    // Draw the src points again, as the translation should be virtually lost
    drawPointsInCanvas(squarePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w*2, h+h/5);
                        canvasContext.fill();
                        drawPointsInCanvas(rectanglePoints, canvasContext, w+padBetweenImgs);}))
}

function test10(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    let canvasContext = createCanvasContext("Identity Transform")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("projective", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(squarePoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(squarePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();
                        drawPointsInCanvas(squarePoints, canvasContext, w+padBetweenImgs);}))
}
function test11(){
    const perspectivePoints = [[0, 0], [0, h], [w, h*2/10], [w, h*8/10]];
    const oppositePerspectivePoints = [[0, h*2/10], [0, h*8/10], [w, 0], [w, h]];
    let canvasContext = createCanvasContext("Opposite Perspective Transform")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("projective", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(perspectivePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(oppositePerspectivePoints);
    const result = identityHomography.warp(testImg);
    console.log(result);
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(perspectivePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();
                        /*drawPointsInCanvas(oppositePerspectivePoints, canvasContext, w+padBetweenImgs);*/}))
}

function test12(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const mirrorPoints = [[w-w/8, 0], [w-w/8, h], [0+w/8, 0], [0+w/8, h]];
    let canvasContext = createCanvasContext("Mirror Transform + Width reshape")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("projective", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(mirrorPoints);
    const result = identityHomography.warp(testImg);
    console.log(result);
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(squarePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();
                        drawPointsInCanvas(mirrorPoints, canvasContext, w+padBetweenImgs-w/8);}))
}

function createCanvasContext(title = "Test", width = null, height = null) {
    width = width === null? w : width;
    height = height === null? h :height;
    let div = document.createElement('div');
    div.style.width = '80%';
    let h1 = document.createElement('h1');
    h1.textContent = title;
    h1.style.textAlign = 'center';
    div.appendChild(h1);
    // Build the canvas
    let canvas = document.createElement('canvas');
    canvas.height = height;
    canvas.width = width*2+padBetweenImgs;
    canvas.style.width = '100%'
    canvas.style.display = 'block'
    div.appendChild(canvas);
    document.body.appendChild(div);
    return canvas.getContext("2d");
}

function addTitle(title){
    let h1 = document.createElement('h1');
    h1.textContent = title;
    h1.style.textAlign = 'center';
    h1.style.width = '80%';
    document.body.appendChild(h1);
}

function addSecondsToTitle(seconds){
    let lastH1 = document.body.lastChild.firstChild;
    lastH1.textContent += ` [${seconds.toFixed(3)} s]`
}

function drawPointsInCanvas(points, canvasContext, xOffset, triangles = null, radius = 8, color='blue')
{
    for (const [x, y] of points){
        canvasContext.beginPath();
        canvasContext.arc(xOffset+x, y, radius, 0, 2 * Math.PI);
        canvasContext.fillStyle = color;
        canvasContext.fill();
    }

    if (triangles !== null){
        for (const [p1, p2, p3] of triangles){
            drawSegment(canvasContext, points[p1], points[p2], xOffset);
            drawSegment(canvasContext, points[p1], points[p3], xOffset);
            drawSegment(canvasContext, points[p2], points[p3], xOffset);
        }
    }
}
function drawSegment(context, [ax, ay], [bx, by], xOffset = 0, color='green', lineWidth=2) {
    context.beginPath();
    context.moveTo(ax+xOffset, ay);
    context.lineTo(bx+xOffset, by);
    context.lineWidth = lineWidth;
    context.strokeStyle = color;
    context.stroke();
}


