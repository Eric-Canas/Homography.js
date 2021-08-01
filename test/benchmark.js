import {Homography} from '../Homography.js';

const w = 400, h = 400;
const padBetweenImgs = w/4;
// Charge testImg
let testImg = document.createElement('img');
testImg.src = './testImg.png'
testImg.onload = () => runTests();


function runTests(){
    addTitle("Piecewise Performance To Same Width")
    test2Faces(false, 10000, w, h);
    test2Faces(false, 10000, w/2, h/2);
    test2Faces(false, 10000, w*2, h*2);
    //test2Faces(true, 10, w, h);       

    testNFaces(false, 10000, 20, 10, w, h);
    testNFaces(false, 10000, 20, 10, w/2, h/2);
    testNFaces(false, 10000, 20, 10, w*2, h*2);
    //testNFaces(true, 100, 20, 10, w*0.7, h*0.7);

    testNFaces(false, 10000, 160, 80, w, h);
    testNFaces(false, 10000, 160, 80, w/2, h/2);
    testNFaces(false, 10000, 160, 80, w*2, h*2);
    //testNFaces(true, 10, 160, 80, w, h);

    addTitle("Affine Transforms");
    testAffine(false, 10000, w, h);
    testAffine(false, 10000, w/2, h/2);
    testAffine(false, 10000, w*2, h*2);

    addTitle("Projective Transforms");
    testProjective(false, 10000, w, h);
    testProjective(false, 10000, w/2, h/2);
    testProjective(false, 10000, w*2, h*2);

}


function testNFaces(print=true, framesToAverage = 1000, pointsInX=40, pointsInY=20, outputWidth = w, outputHeight=h){
    // Points are given normalized
    let srcPoints = [];
    let dstPoints = [];
    const cycleEvery = 1;
    const amplitude = 20;

    for (let y = amplitude; y <= h-amplitude; y+=h/pointsInY){
        for (let x = 0; x <= w; x+=w/pointsInX){
            srcPoints.push([x, y]);
            dstPoints.push([x*(outputWidth/w), (y+Math.sin((x*8)/Math.PI)*amplitude)*(outputHeight/h)]);
        }    
    }

    //Rest of Destiny points
    let allDstPoints = [];
    for (let i = 0; i<framesToAverage; i++){
        allDstPoints.push([])
        for (let y = amplitude; y <= h-amplitude; y+=h/pointsInY){
            for (let x = 0; x <= w; x+=w/pointsInX){
                allDstPoints[i].push([x*(outputWidth/w), (y+Math.sin((x*(((i%cycleEvery)+8)))/Math.PI)*amplitude)*(outputHeight/h)]);
            }    
        }
    }
    const eachIterationLength = allDstPoints[0].flat().flat().length;
    const allDstPoints2 = new Float32Array(allDstPoints.flat().flat()); 
    let canvasContext;
    if(print){
        canvasContext = canvasContext = createCanvasContext(`PERFORMANCE INCLUDING CANVAS RENDERINGS.
                                                            `, Math.max(outputWidth, w), Math.max(outputHeight, h));
        canvasContext.drawImage(testImg, 0, 0, w, h);
        canvasContext.fill();
    }
    // ----------- Create the first transform ---------------
    const first = performance.now();
    // Don't set the width and height from the beginning
    const identityHomography = new Homography("piecewiseaffine");
    identityHomography.setSourcePoints(srcPoints, testImg, w, h, false);    
    identityHomography.setDestinyPoints(dstPoints, false);
    // Sets the image jst before the warping
    // Call the warping without any image
    let result = identityHomography.warp();
    const firstEnd = performance.now();
    if (print){
        drawPointsInCanvas(srcPoints, canvasContext, 0, identityHomography._triangles);
    }


    // ----------- Measure the time the take -------------
    const bucleTimeStart = performance.now()
    if(print){
    for (let i = 0; i<framesToAverage; i++){
        identityHomography.setDestinyPoints(allDstPoints2.subarray(i*eachIterationLength, (i+1)*eachIterationLength), false);
        result = identityHomography.warp();    
        canvasContext.clearRect(w+padBetweenImgs, 0, result.width, result.height)
        canvasContext.putImageData(result, w+padBetweenImgs, 0);
        canvasContext.fill();
        }
    } else {
        for (let i = 0; i<framesToAverage; i++){
            identityHomography.setDestinyPoints(allDstPoints2.subarray(i*eachIterationLength, (i+1)*eachIterationLength), false);
            result = identityHomography.warp();
        } 
    }
    const bucleTimeEnd = performance.now();
    const timeInSeconds = ((bucleTimeEnd-bucleTimeStart)/1000)/framesToAverage;
    if (print){
        addToTitle(`Shape: ${w}x${h} To ${outputWidth}x${outputHeight} - ${identityHomography._triangles.length/3} Triangles - 
            Avg Trasnformation Time:  ${timeInSeconds.toFixed(4)} s (${(1/timeInSeconds).toFixed(2)} FPS) [First Frame: ${((firstEnd-first)/1000).toFixed(3)} s]`)
    } else {
        addTitle(`PERFORMANCE WITHOUT CANVAS RENDERING. 
        Shape: ${w}x${h} To ${outputWidth}x${outputHeight} - ${identityHomography._triangles.length/3} Triangles - 
        Avg Trasnformation Time:  ${timeInSeconds.toFixed(4)} s (${(1/timeInSeconds).toFixed(2)} FPS) [First Frame: ${((firstEnd-first)/1000).toFixed(3)} s]`)
    }
    
}

function test2Faces(print=true, framesToAverage = 1000, outputWidth = w, outputHeight=h){
    // Points are given normalized    
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const dstPoints = [[outputWidth/4, outputHeight/4], [0, outputHeight/2], [outputWidth, 0], [outputWidth*5/8, outputHeight*6/8]];
    let canvasContext;
    if(print){
        canvasContext = createCanvasContext(`PERFORMANCE INCLUDING CANVAS RENDERINGS.
                                                                                    `, Math.max(outputWidth, w), Math.max(outputHeight, h));
        canvasContext.drawImage(testImg, 0, 0, w, h);
        canvasContext.fill();
    }
    // ----------- Create the first transform ---------------
    const first = performance.now();
    // Don't set the width and height from the beginning
    const identityHomography = new Homography("piecewiseaffine");
    identityHomography.setSourcePoints(squarePoints, testImg, w, h, false);    
    identityHomography.setDestinyPoints(dstPoints, false);
    // Sets the image jst before the warping
    // Call the warping without any image
    let result = identityHomography.warp();
    const firstEnd = performance.now();
    if (print){
        drawPointsInCanvas(squarePoints, canvasContext, 0, identityHomography._triangles);
    }
    // ------- Add the first transform time ------------
    // Create all the future transforms reference points
    const cycleEvery = 25;
    const movementArray = [[0, 0], [0, -(outputHeight*1/4)/cycleEvery], [0, 0], [(outputWidth*3/8)/cycleEvery, 0]];
    const pointsLength = dstPoints.flat().length;
    let allSequenceDstPoints = new Float32Array(framesToAverage*dstPoints.flat().length);
    for(let i = 0; i<framesToAverage; i++){
        for (let point = 0; point<dstPoints.length; point++){
            const [srcX, srcY] = dstPoints[point];
            const [movementX, movementY] = movementArray[point];
            const cycleStep = i%cycleEvery;
            //Increment Step
            if (((~~(i/cycleEvery))%2) === 0){
                allSequenceDstPoints[i*pointsLength+point*2] = srcX+movementX*cycleStep;
                allSequenceDstPoints[i*pointsLength+point*2+1] = srcY+movementY*cycleStep;
            //DecrementStep
            } else {
                allSequenceDstPoints[i*pointsLength+point*2] = srcX+movementX*cycleEvery-(movementX*cycleStep);
                allSequenceDstPoints[i*pointsLength+point*2+1] = srcY+movementY*cycleEvery-(movementY*cycleStep);
            }

        }
    }

    // ----------- Measure the time the take -------------
    const bucleTimeStart = performance.now()
    if(print){
    for (let i = 0; i<framesToAverage; i++){
        identityHomography.setDestinyPoints(allSequenceDstPoints.subarray(i*pointsLength, (i+1)*pointsLength), false);
        result = identityHomography.warp();    
        canvasContext.clearRect(w+padBetweenImgs, 0, result.width, result.height)
        canvasContext.putImageData(result, w+padBetweenImgs, 0);
        canvasContext.fill();
        }
    } else {
        for (let i = 0; i<framesToAverage; i++){
            identityHomography.setDestinyPoints(allSequenceDstPoints.subarray(i*pointsLength, (i+1)*pointsLength), false);
            result = identityHomography.warp();
        } 
    }
    const bucleTimeEnd = performance.now();
    const timeInSeconds = ((bucleTimeEnd-bucleTimeStart)/1000)/framesToAverage;
    if (print){
        addToTitle(`Shape: ${w}x${h} To ${outputWidth}x${outputHeight} - ${identityHomography._triangles.length/3} Triangles - 
            Avg Trasnformation Time:  ${timeInSeconds.toFixed(4)} s (${(1/timeInSeconds).toFixed(2)} FPS) [First Frame: ${((firstEnd-first)/1000).toFixed(3)} s]`)
    } else {
        addTitle(`PERFORMANCE WITHOUT CANVAS RENDERING. 
        Shape: ${w}x${h} To ${outputWidth}x${outputHeight} - ${identityHomography._triangles.length/3} Triangles - 
        Avg Trasnformation Time:  ${timeInSeconds.toFixed(4)} s (${(1/timeInSeconds).toFixed(2)} FPS) [First Frame: ${((firstEnd-first)/1000).toFixed(3)} s]`)
    }
    
}

function testAffine(print=true, framesToAverage = 1000, outputWidth = w, outputHeight=h){
    // Points are given normalized    
    const squarePoints = [[0, 0], [0, h], [w, 0]];
    const dstPoints = [[0, outputHeight/2], [outputWidth/2, outputHeight*8/10], [outputWidth/2, 0]];
    let canvasContext;
    if(print){
        canvasContext = createCanvasContext(`PERFORMANCE INCLUDING CANVAS RENDERINGS.
                                                                                    `, Math.max(outputWidth, w), Math.max(outputHeight, h));
        canvasContext.drawImage(testImg, 0, 0, w, h);
        canvasContext.fill();
    }
    // ----------- Create the first transform ---------------
    const first = performance.now();
    // Don't set the width and height from the beginning
    const identityHomography = new Homography("affine");
    identityHomography.setSourcePoints(squarePoints, testImg, w, h, false);    
    identityHomography.setDestinyPoints(dstPoints, false);
    // Sets the image jst before the warping
    // Call the warping without any image
    let result = identityHomography.warp();
    const firstEnd = performance.now();
    if (print){
        drawPointsInCanvas(squarePoints, canvasContext, 0);
    }
    // ------- Add the first transform time ------------
    // Create all the future transforms reference points
    const cycleEvery = 3;
    const movementArray = [[0, 0], [0, (outputHeight/10)/cycleEvery], [0, 0]];
    const pointsLength = dstPoints.flat().length;
    let allSequenceDstPoints = new Float32Array(framesToAverage*dstPoints.flat().length);
    for(let i = 0; i<framesToAverage; i++){
        for (let point = 0; point<dstPoints.length; point++){
            const [srcX, srcY] = dstPoints[point];
            const [movementX, movementY] = movementArray[point];
            const cycleStep = i%cycleEvery;
            //Increment Step
            if (((~~(i/cycleEvery))%2) === 0){
                allSequenceDstPoints[i*pointsLength+point*2] = srcX+movementX*cycleStep;
                allSequenceDstPoints[i*pointsLength+point*2+1] = srcY+movementY*cycleStep;
            //DecrementStep
            } else {
                allSequenceDstPoints[i*pointsLength+point*2] = srcX+movementX*cycleEvery-(movementX*cycleStep);
                allSequenceDstPoints[i*pointsLength+point*2+1] = srcY+movementY*cycleEvery-(movementY*cycleStep);
            }

        }
    }

    // ----------- Measure the time the take -------------
    const bucleTimeStart = performance.now()
    if(print){
        canvasContext.clearRect(w+padBetweenImgs, 0, Math.max(outputWidth, w), Math.max(outputHeight, h))
        for (let i = 0; i<framesToAverage; i++){
            identityHomography.setDestinyPoints(allSequenceDstPoints.subarray(i*pointsLength, (i+1)*pointsLength), false);
            result = identityHomography.warp();    
            canvasContext.clearRect(w+padBetweenImgs, 0, result.width, result.height)
            canvasContext.putImageData(result, w+padBetweenImgs, 0);
            canvasContext.fill();
            }
    } else {
        for (let i = 0; i<framesToAverage; i++){
            identityHomography.setDestinyPoints(allSequenceDstPoints.subarray(i*pointsLength, (i+1)*pointsLength), false);
            result = identityHomography.warp();
        } 
    }
    const bucleTimeEnd = performance.now();
    const timeInSeconds = ((bucleTimeEnd-bucleTimeStart)/1000)/framesToAverage;
    if (print){
        addToTitle(`Shape: ${w}x${h} To ${outputWidth}x${outputHeight} - 
            Avg Trasnformation Time:  ${timeInSeconds.toFixed(4)} s (${(1/timeInSeconds).toFixed(2)} FPS) [First Frame: ${((firstEnd-first)/1000).toFixed(3)} s]`)
    } else {
        addTitle(`PERFORMANCE WITHOUT CANVAS RENDERING. 
        Shape: ${w}x${h} To ${outputWidth}x${outputHeight} - 
        Avg Trasnformation Time:  ${timeInSeconds.toFixed(4)} s (${(1/timeInSeconds).toFixed(2)} FPS) [First Frame: ${((firstEnd-first)/1000).toFixed(3)} s]`)
    }
    
}

function testProjective(print=true, framesToAverage = 1000, outputWidth = w, outputHeight=h){
    // Points are given normalized    
    const squarePoints = [[0, 0], [0, h], [w, 0], [w, h]];
    const dstPoints = [[outputWidth/10, 0], [outputWidth/10, outputHeight], [outputWidth, outputHeight*2/8], [outputWidth, outputHeight*6/8]];
    let canvasContext;
    if(print){
        canvasContext = createCanvasContext(`PERFORMANCE INCLUDING CANVAS RENDERINGS.
                                                                                    `, Math.max(outputWidth, w), Math.max(outputHeight, h));
        canvasContext.drawImage(testImg, 0, 0, w, h);
        canvasContext.fill();
    }
    // ----------- Create the first transform ---------------
    const first = performance.now();
    // Don't set the width and height from the beginning
    const identityHomography = new Homography("projective");
    identityHomography.setSourcePoints(squarePoints, testImg, w, h, false);    
    identityHomography.setDestinyPoints(dstPoints, false);
    // Sets the image jst before the warping
    // Call the warping without any image
    let result = identityHomography.warp();
    const firstEnd = performance.now();
    if (print){
        drawPointsInCanvas(squarePoints, canvasContext, 0);
    }
    // ------- Add the first transform time ------------
    // Create all the future transforms reference points
    const cycleEvery = 10;
    const movementArray = [[0, 0], [0, 0], [0, -(outputHeight*1/8)/cycleEvery], [0, (outputHeight*1/8)/cycleEvery]];
    const pointsLength = dstPoints.flat().length;
    let allSequenceDstPoints = new Float32Array(framesToAverage*dstPoints.flat().length);
    for(let i = 0; i<framesToAverage; i++){
        for (let point = 0; point<dstPoints.length; point++){
            const [srcX, srcY] = dstPoints[point];
            const [movementX, movementY] = movementArray[point];
            const cycleStep = i%cycleEvery;
            //Increment Step
            if (((~~(i/cycleEvery))%2) === 0){
                allSequenceDstPoints[i*pointsLength+point*2] = srcX+movementX*cycleStep;
                allSequenceDstPoints[i*pointsLength+point*2+1] = srcY+movementY*cycleStep;
            //DecrementStep
            } else {
                allSequenceDstPoints[i*pointsLength+point*2] = srcX+movementX*cycleEvery-(movementX*cycleStep);
                allSequenceDstPoints[i*pointsLength+point*2+1] = srcY+movementY*cycleEvery-(movementY*cycleStep);
            }

        }
    }

    // ----------- Measure the time the take -------------
    const bucleTimeStart = performance.now()
    if(print){
        canvasContext.clearRect(w+padBetweenImgs, 0, Math.max(outputWidth, w), Math.max(outputHeight, h))
        for (let i = 0; i<framesToAverage; i++){
            identityHomography.setDestinyPoints(allSequenceDstPoints.subarray(i*pointsLength, (i+1)*pointsLength), false);
            result = identityHomography.warp();    
            canvasContext.clearRect(w+padBetweenImgs, 0, result.width, result.height)
            canvasContext.putImageData(result, w+padBetweenImgs, 0);
            canvasContext.fill();
            }
    } else {
        for (let i = 0; i<framesToAverage; i++){
            identityHomography.setDestinyPoints(allSequenceDstPoints.subarray(i*pointsLength, (i+1)*pointsLength), false);
            result = identityHomography.warp();
        } 
    }
    const bucleTimeEnd = performance.now();
    const timeInSeconds = ((bucleTimeEnd-bucleTimeStart)/1000)/framesToAverage;
    if (print){
        addToTitle(`Shape: ${w}x${h} To ${outputWidth}x${outputHeight} - 
            Avg Trasnformation Time:  ${timeInSeconds.toFixed(4)} s (${(1/timeInSeconds).toFixed(2)} FPS) [First Frame: ${((firstEnd-first)/1000).toFixed(3)} s]`)
    } else {
        addTitle(`PERFORMANCE WITHOUT CANVAS RENDERING. 
        Shape: ${w}x${h} To ${outputWidth}x${outputHeight} - 
        Avg Trasnformation Time:  ${timeInSeconds.toFixed(4)} s (${(1/timeInSeconds).toFixed(2)} FPS) [First Frame: ${((firstEnd-first)/1000).toFixed(3)} s]`)
    }
    
}

function testCSS1(){
    // One in image coordinates and the other normalized
    const squarePoints = [[0, 0], [0, 1], [1, 0]];
    const rectanglePoints = [[0, 0], [1/2, 1], [1, 1/8]];
    
    let div = document.createElement('div');
    div.style.width = '80%';
    let h1 = document.createElement('h1');
    h1.textContent = 'Using transformation matrix in a Text Box';
    h1.style.textAlign = 'center';
    div.appendChild(h1);
    let inputText = document.createElement('textarea');
    inputText.rows = 5;
    inputText.cols = 20;
    inputText.textContent = '\n\nHello World!'
    inputText.style.textAlign = 'center';
    inputText.style.position = 'relative';
    inputText.style.display = 'block';
    inputText.style.margin = '0 auto';
    div.appendChild(inputText);
    document.body.appendChild(div);
    const s0 = performance.now();
    const identityHomography = new Homography("affine");
    // Sets the width - height from the very beginning, with non normalized coordinates
    identityHomography.setSourcePoints(squarePoints);
    // Don't set the image until the warping
    identityHomography.setDestinyPoints(rectanglePoints);
    const cssTransform = identityHomography.getTransformationMatrixAsCSS();
    const s1 = performance.now();
    h1.textContent += ` [Estimated in ${((s1-s0)/1000).toFixed(4)} s]`;
    inputText.style.transform = cssTransform;
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

function addToTitle(attach){
    let lastH1 = document.body.lastChild.firstChild;
    lastH1.textContent += attach
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
function drawSegment(context, [ax, ay], [bx, by], xOffset = 0, color='green', lineWidth=2) {
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

