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
    test4();
    test5();

}

function test1(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    let canvasContext = createCanvasContext("Identity Transform")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    //const s0 = performance.now();
    const identityHomography = new Homography(w, h);
    const s0 = performance.now();
    identityHomography.setSourcePoints(squarePoints);
    const a = performance.now();
    identityHomography.setDstPoints(squarePoints);
    const b = performance.now();
    const result = identityHomography.warp(testImg);
    const c = performance.now();
    const img = identityHomography.getImageFromRGBAArray(result);
    const d = performance.now();
    console.log(`Create and Set source Time ${(a-s0)/1000} s, calculate transformation matrices ${(b-a)/1000} s, warp time ${(c-b)/1000}, transform to img ${(d-c)/1000}`); 
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    img.onload = (() => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();}).bind(this)
}

function test2(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const dstPoints = [[0, 0], [0, h], [w, 0], [w*3/4, h*3/4]];
    let canvasContext = createCanvasContext("Bottom-Left triangle shortened")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    const identityHomography = new Homography(w, h);
    identityHomography.setSourcePoints(squarePoints);
    identityHomography.setDstPoints(dstPoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.getImageFromRGBAArray(result);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    img.onload = (() => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();}).bind(this)
}

function test3(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const dstPoints = [[0, 0], [0, h], [w, 0], [w/4, h/4]];
    let canvasContext = createCanvasContext("Superposition")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    const identityHomography = new Homography(w, h);
    identityHomography.setSourcePoints(squarePoints);
    identityHomography.setDstPoints(dstPoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.getImageFromRGBAArray(result);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    img.onload = (() => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();}).bind(this)
}

function test4(){
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const dstPoints = [[w/6, h/6], [0, h/2], [w, 0], [w*7/8, h*3/8]];
    let canvasContext = createCanvasContext("Both Triangle shortened")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    const identityHomography = new Homography(w, h);
    identityHomography.setSourcePoints(squarePoints);
    identityHomography.setDstPoints(dstPoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.getImageFromRGBAArray(result);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    img.onload = (() => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, h);
                        canvasContext.fill();}).bind(this)
}

function test5(){
    let newH  = h/3;
    const squarePoints = [[0, 0], [0, newH], [w, 0], [w, newH]];
    const dstPoints = [[0, 0], [0, newH], [w, 0], [w*3/4, newH*3/4]];
    let canvasContext = createCanvasContext("Rectangular Images (Bottom-Left triangle shortened)")
    canvasContext.drawImage(testImg, 0, 0, w, newH);
    canvasContext.fill();
    const s0 = performance.now();
    const identityHomography = new Homography(w, newH);
    identityHomography.setSourcePoints(squarePoints);
    identityHomography.setDstPoints(dstPoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.getImageFromRGBAArray(result);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    img.onload = (() => {canvasContext.drawImage(img, w+padBetweenImgs, 0, w, newH);
                        canvasContext.fill();}).bind(this)
}

function createCanvasContext(title = "Test"){
    let div = document.createElement('div');
    div.style.width = '80%';
    let h1 = document.createElement('h1');
    h1.textContent = title;
    h1.style.textAlign = 'center';
    div.appendChild(h1);
    // Build the canvas
    let canvas = document.createElement('canvas');
    canvas.height = h;
    canvas.width = w*2+padBetweenImgs;
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


