import {Homography} from '../Homography.js';

const w = 400, h = 400;
const padBetweenImgs = w/4;
// Charge testImg
let testImg = document.createElement('img');
testImg.src = './testImg.png'
testImg.onload = () => runTests();


function runTests(){
    test1();
    test2();
    test3();

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

    const identityHomography = new Homography(w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDstPoints(squarePoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();}))
}

function test2(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const dstPoints = [[w/5, h/5], [0, h/2], [w, 0], [w*6/8, h*6/8]];
    let canvasContext = createCanvasContext("Transforming both triangles of the square")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    // Don't set the width and height from the beginning
    const identityHomography = new Homography();
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
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();}))
}

function test3(){
    let newW = w*1.5;
    let newH  = h/1.5;
    const rectanglePoints = [[0, 0], [0, newH], [newW, 0], [newW, newH]];
    const dstPoints = [[0, 0], [0, newH], [newW, 0], [newW*3/4, newH*3/4]];
    let canvasContext = createCanvasContext("Resizing the image to Non-square", newW, newH)
    canvasContext.drawImage(testImg, 0, 0, newW, newH);
    canvasContext.fill();
    const s0 = performance.now();
    // Set the width and height from the beginning
    const identityHomography = new Homography(newW, newH);
    identityHomography.setSourcePoints(rectanglePoints);
    identityHomography.setImage(testImg)
    identityHomography.setDstPoints(dstPoints, newW, newH);
    const result = identityHomography.warp();
    
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    img.then(((img) => {canvasContext.drawImage(img, newW+padBetweenImgs, 0, newW, newH);
                        canvasContext.fill();}))
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

function addSecondsToTitle(seconds){
    let lastH1 = document.body.lastChild.firstChild;
    lastH1.textContent += ` [${seconds.toFixed(3)} s]`
}


