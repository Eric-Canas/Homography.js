import {Homography} from '../Homography.js';

const test = 1;

const w = 20, h = 20;
// Build the canvas
const canvasContext = document.getElementById('cnvs').getContext("2d");
// Charge testImg
let testImg = document.createElement('img');
testImg.src = './testImg.png'
testImg.onload = () => runTest(test);


function runTest(test){
    switch (test){
       case 1 :
           testOne(); 
    }
}

function testOne(){
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();

    const squarePoints = [[0, 0], [0, h-1], [w-1, 0], [w-1, h-1]];

    const identityHomography = new Homography(w, h);
    identityHomography.setSourcePoints(squarePoints);
    identityHomography.piecewiseAffineTransform(squarePoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.getImageFromRGBAArray(result);
    img.onload = (() => {canvasContext.drawImage(img, w+50, 0, w, h);
                        canvasContext.fill();
                        console.log("Printed?");}).bind(this)


}



