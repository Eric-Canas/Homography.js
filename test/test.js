import {Homography} from '../Homography.js';

const w = 400, h = 400;
const padBetweenImgs = w/4;
// Charge testImg
let testImg = document.createElement('img');
testImg.src = './testImgLogoBlack.png'
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
    testCSS1();

    addTitle("Projective Transforms");
    test10();
    test11();
    test12();
    testCSS2();
}


function test1(){
    const squarePoints = [[0, 0], [0, 0.5], [0.5, 0], [0.5, 0.5], [0.5, 1], [1, 0.5], [1, 1], [0, 1], [1, 0]];
    const squarePointsShifted = [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [2, 2], [0, 2], [2, 0]];;
    let canvasContext = createCanvasContext("Shift (phantom) and Upsample Transform (Most expensive opperation)", w*2, h*2)
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("piecewiseaffine");
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setReferencePoints(squarePoints, squarePointsShifted);
    const result = identityHomography.warp(testImg);
    console.log(result)
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(denormalizePoints(squarePoints, w, h), canvasContext, 0, identityHomography._triangles);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(denormalizePoints(squarePoints, w*2, h*2), canvasContext, w+padBetweenImgs, identityHomography._triangles);}))
}

function test2(){
    // Points are given normalized
    const squarePoints = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const dstPoints = [[1/5, 1/5], [0, 1/2], [1, 0], [1*6/8, 1*6/8]];
    let canvasContext = createCanvasContext("Piecewise Affine Transform from 4 reference points")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    // Don't set the width and height from the beginning
    const identityHomography = new Homography("piecewiseaffine");
    // But sets it when source points
    identityHomography.setReferencePoints(squarePoints, dstPoints);
    // Sets the image jst before the warping
    // Call the warping without any image
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)

    drawPointsInCanvas(denormalizePoints(squarePoints, w, h), canvasContext, 0, identityHomography._triangles);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(denormalizePoints(dstPoints, w, h), canvasContext, w+padBetweenImgs, identityHomography._triangles);}))
}


function test3(){
    //Source points are not normalized
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    //But destiny points are
    const dstPoints = [[0, 0], [0, 1/2], [1/2, 0], [1/6, 1/12]];
    let canvasContext = createCanvasContext("Resize through dstPoints + Overlapping")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    // Don't set the width and height at any moment
    const identityHomography = new Homography("piecewiseaffine");
    // And sets the image from the source points
    identityHomography.setSourcePoints(squarePoints, testImg);
    identityHomography.setDestinyPoints(dstPoints);
    // Call the warping without any image
    const result = identityHomography.warp();

    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(squarePoints, canvasContext, 0, identityHomography._triangles);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(denormalizePoints(dstPoints, w, h), canvasContext, w+padBetweenImgs, identityHomography._triangles);}))
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
    // Set the width and height from the beginning. This way, image is resized on origin, and newH corresponds to the vertex.
    const identityHomography = new Homography("piecewiseaffine", newW, newH);
    identityHomography.setSourcePoints(rectanglePoints);
    identityHomography.setImage(testImg)
    identityHomography.setDestinyPoints(dstPoints);
    const img = identityHomography.warp(null, true);

    const s1 = performance.now();
    drawPointsInCanvas(rectanglePoints, canvasContext, 0, identityHomography._triangles);
    addSecondsToTitle((s1-s0)/1000)
    img.then(((img) => {canvasContext.drawImage(img, newW+padBetweenImgs, 0, img.width, img.height);
                        canvasContext.fill();
                        drawPointsInCanvas(dstPoints, canvasContext, newW+padBetweenImgs, identityHomography._triangles);}))
}

function test5(){
    let srcPoints = [], dstPoints = [];
    const pointsInX = 20;
    const pointsInY = 10;
    const amplitude = 20;
    const n = 8;
    for (let y = 0; y <= h; y+=h/pointsInY){
        for (let x = 0; x <= w; x+=w/pointsInX){
            srcPoints.push([x, y]);
            dstPoints.push([x, amplitude+y+Math.sin((x*n)/Math.PI)*amplitude]);
        }    
    }
    let canvasContext = createCanvasContext("Piecewise Affine Sinusoidal Transform", w, h+amplitude*2)
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    // Don't set the width and height at any moment
    const identityHomography = new Homography("piecewiseaffine", w, h);
    identityHomography.setImage(testImg);
    const s0 = performance.now();
    // And sets the image togheter with
    identityHomography.setSourcePoints(srcPoints);
    // Don't set any width or height in any moment
    identityHomography.setDestinyPoints(dstPoints);
    // Call the warping without any image
    const result = identityHomography.warp();
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();
    drawPointsInCanvas(srcPoints, canvasContext, 0, identityHomography._triangles, 4);
    addSecondsToTitle((s1-s0)/1000)
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        /*drawPointsInCanvas(dstPoints, canvasContext, w+padBetweenImgs, identityHomography._triangles, 4);*/}))
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
    identityHomography.setDestinyPoints(displacedPoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    // Draw the src points again, as the translation should be virtually lost
    drawPointsInCanvas(squarePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(squarePoints, canvasContext, w+padBetweenImgs);}))
}


function test7(){
    // Use normalized points
    const squarePoints = [[0, 0], [0, 1], [1, 0]];
    const rotatedPoints = [[0, 1/2], [1/2, 1], [1/2, 0]];
    let canvasContext = createCanvasContext("45 Degrees Rotation")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("affine");
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints, null);
    // Don't set the image until the warping
    identityHomography.setDestinyPoints(rotatedPoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, false);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(denormalizePoints(squarePoints, w, h), canvasContext, 0);
    img.onload = () => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(denormalizePoints(rotatedPoints, w, h), canvasContext, w+padBetweenImgs);}
}

function test8(){
    // Affine
    const squarePoints = [[0, 0], [0, 1], [1, 0]];
    const shorterRectangle = [[0, 0], [0, 1/1.25], [1/1.75, 0]];  
    const rectanglePoints = [[0, 0], [0, 1*1.25], [1*1.75, 0]];    
    let canvasContext = createCanvasContext("Resize Transform with 10 intermediate (discarded) transforms", w*1.75, h*1.25)
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    // Never set the height and width
    const identityHomography = new Homography("affine");
    identityHomography.setSourcePoints(squarePoints);
    let result;
    // Do multiple transformations before for ensuring that consistency is kept
    for (let i = 0; i < 10; i++){
        // Transform first with a shorter rectangle
        identityHomography.setDestinyPoints(shorterRectangle);
        const result_to_discard = identityHomography.warp(testImg);
        // Transform then with the second large rectangle
        identityHomography.setDestinyPoints(rectanglePoints);
        result = identityHomography.warp(testImg);
        
    }
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    // Draw the src points again, as the translation should be virtually lost
    drawPointsInCanvas(denormalizePoints(squarePoints, w, h), canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(denormalizePoints(rectanglePoints, w, h), canvasContext, w+padBetweenImgs);}))
}

function test9(){
    // One in image coordinates and the other normalized
    const squarePoints = [[0, 0], [0, 1], [1, 0]];
    const rectanglePoints = [[0, 0], [w, h], [w, h/5]];      
    let canvasContext = createCanvasContext("Complex Transform", w*2, h+h/5)
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("affine");
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    identityHomography.setImage(testImg);
    // Don't set the image until the warping
    identityHomography.setDestinyPoints(rectanglePoints);
    const result = identityHomography.warp();
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    // Draw the src points again, as the translation should be virtually lost
    drawPointsInCanvas(denormalizePoints(squarePoints, w, h), canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
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
    identityHomography.setDestinyPoints(squarePoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(squarePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(squarePoints, canvasContext, w+padBetweenImgs);}))
}

function test11(){
    const squarePoints = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const mirrorPoints = [[1-1/8, 0], [1-1/8, 1], [0+1/8, 0], [0+1/8, 1]];
    let canvasContext = createCanvasContext("Mirror Transform + Width reshape")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("projective");
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints, null, w, h);
    // Don't set the image until the warping
    identityHomography.setDestinyPoints(mirrorPoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(denormalizePoints(squarePoints, w, h), canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(denormalizePoints(mirrorPoints, w, h), canvasContext, w+padBetweenImgs-w/8);}))
}

function test12(){
    const perspectivePoints = [[0, 0], [0, h], [w, h*2/10], [w, h*8/10]];
    const oppositePerspectivePoints = [[0, h*2/10], [0, h*8/10], [w, 0], [w, h]];
    let canvasContext = createCanvasContext("Opposite Perspective Transform", w, h+h*2/3);
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();

    const identityHomography = new Homography("projective", w, h);
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(perspectivePoints);
    // Don't set the image until the warping
    identityHomography.setDestinyPoints(oppositePerspectivePoints);
    const result = identityHomography.warp(testImg);
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();

    addSecondsToTitle((s1-s0)/1000)
    drawPointsInCanvas(perspectivePoints, canvasContext, 0);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        /*drawPointsInCanvas(denormalizePoints(normalizePoints(oppositePerspectivePoints, w, h), result.width, result.height), canvasContext, w+padBetweenImgs);*/}))
}

function testCSS1(){
    // One in image coordinates and the other normalized
    const squarePoints = [[0, 0], [0, 1], [1, 0]];
    const rectanglePoints = [[0, 0], [1/2, 1], [1, 1/8]];
    
    let div = document.createElement('div');
    div.style.width = '80%';
    let h1 = document.createElement('h1');
    h1.textContent = 'Affine Transform in a Text Box';
    h1.style.textAlign = 'center';
    div.appendChild(h1);
    let inputText = document.createElement('textarea');
    inputText.rows = 5;
    inputText.cols = 10;
    inputText.textContent = '\n\nHello World!'
    inputText.style.textAlign = 'center';
    inputText.style.position = 'relative';
    inputText.style.display = 'block';
    inputText.style.margin = '0 auto';
    inputText.style.width = '40%';
    inputText.style.fontSize = '28px';
    div.appendChild(inputText);
    document.body.appendChild(div);
    const s0 = performance.now();
    const identityHomography = new Homography("auto");
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.transformHTMLElement(inputText, squarePoints, rectanglePoints);
    const s1 = performance.now();
    h1.textContent += ` [${((s1-s0)/1000).toFixed(4)} s]`;
}

function testCSS2(){
    const perspectivePoints = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const oppositePerspectivePoints = [[0, 0], [0, 1], [0.8, 0.4], [0.95, 1]];
    // Build he elements
    let div = document.createElement('div');
    div.style.width = '80%';
    let h1 = document.createElement('h1');
    h1.textContent = 'Using transformation in a composed HTML Div';
    h1.style.textAlign = 'center';
    div.appendChild(h1);
    
    let button = document.createElement('button');
    button.textContent = 'Hello World!'
    button.style.textAlign = 'center';
    button.style.height = "20%";
    // And apply some style on them
    let div2 = document.createElement('div2');
    div2.style.position = 'relative';
    div2.style.display = 'flex';
    div2.style.margin = 'auto';
    div2.style.width = '30%';
    div2.style.height = '150px';
    div2.style.justifyContent = 'center';
    div2.style.background = 'BurlyWood';
    div2.style.alignItems = 'center';
    div2.style.borderRadius = '5%';

    div2.appendChild(button);
    div.appendChild(div2);
    document.body.appendChild(div);

    //Finally make the projective transform 
    const s0 = performance.now();
    const identityHomography = new Homography("projective");
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(perspectivePoints);
    // Don't set the image until the warping
    identityHomography.setDestinyPoints(oppositePerspectivePoints);
    const cssTransform = identityHomography.getTransformationMatrixAsCSS();
    const s1 = performance.now();
    h1.textContent += ` [Estimated in ${((s1-s0)/1000).toFixed(4)} s]`;
    div2.style.transform = cssTransform;

}

function buildHomographyJSLogo(){
    // Points are given normalized
    const srcPoints = [[0, 0], [0.1, 0], [0.2, 0], [0.3, 0], [0, 0.1], [0.3, 0.1], [0.7, 0], [0.8, 0], [0.9, 0], [1.0, 0], [0.7, 0.1], [0.7, 0.2], [1, 0.1]];
    const dstPoints = [[0, 0], [0.1, 0], [0.2, 0], [0.3, 0], [0.1, 0.1], [0.2, 0.1], [0.7, 0], [0.8, 0], [0.9, 0], [1.0, 0], [0.8, 0.1], [0.8, 0.2], [0.9, 0.1]];
    let canvasContext = createCanvasContext("Transforming both triangles of the square")
    canvasContext.drawImage(testImg, 0, 0, w, h);
    canvasContext.fill();
    const s0 = performance.now();
    // Don't set the width and height from the beginning
    const identityHomography = new Homography("piecewiseaffine");
    // But sets it when source points
    identityHomography.setSourcePoints(srcPoints, null);
    // Don't set any objective width
    identityHomography.setDestinyPoints(dstPoints);
    identityHomography.setImage(testImg);
    // Sets the image jst before the warping
    // Call the warping without any image
    const result = identityHomography.warp();
    const img = identityHomography.HTMLImageElementFromImageData(result, true);
    const s1 = performance.now();
    addSecondsToTitle((s1-s0)/1000)

    drawPointsInCanvas(denormalizePoints(srcPoints, w, h), canvasContext, 0, identityHomography._triangles);
    img.then(((img) => {canvasContext.drawImage(img, w+padBetweenImgs, 0, result.width, result.height);
                        canvasContext.fill();
                        drawPointsInCanvas(denormalizePoints(dstPoints, w, h), canvasContext, w+padBetweenImgs, identityHomography._triangles);}))
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
        for (let i = 0; i < triangles.length; i+=3){
            const [p1, p2, p3] = triangles.subarray(i, i+3);
            drawSegment(canvasContext, points[p1], points[p2], xOffset);
            drawSegment(canvasContext, points[p1], points[p3], xOffset);
            drawSegment(canvasContext, points[p2], points[p3], xOffset);
        }
    }
}
function drawSegment(context, [ax, ay], [bx, by], xOffset = 0, color='green', lineWidth=1) {
    context.beginPath();
    context.moveTo(ax+xOffset, ay);
    context.lineTo(bx+xOffset, by);
    context.lineWidth = lineWidth;
    context.strokeStyle = color;
    context.stroke();
}

function denormalizePoints(points, width = null, height = null){
    width = width === null? w : width;
    height = height === null? h : height;
    let normalizedPoints = [];
    for (let i = 0; i < points.length; i++){
        normalizedPoints.push([points[i][0] * width, points[i][1] * height]);
    }
    return normalizedPoints;
}

function normalizePoints(points, width = null, height = null){
    width = width === null? w : width;
    height = height === null? h : height;
    let normalizedPoints = [];
    for (let i = 0; i < points.length; i++){
        normalizedPoints.push([points[i][0] / width, points[i][1] / height]);
    }
    return normalizedPoints;
}

