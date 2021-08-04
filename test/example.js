import {Homography} from '../Homography.js';

const w = 400, h = 400;
runExample();

function runExample(){
    let testImg = document.createElement('img');
    testImg.src = './testImgLogoBlack.png'
    testImg.onload = () => {
    addTitle("Continuous Projective Transforms");
    testProjective(testImg);};
}
export {runExample};


async function testProjective(testImg){
    //const ctx = document.getElementById("exampleCanvas").getContext("2d");
    const button = document.getElementById("myButton");
    // Build the initial reference points (in this case, in image coordinates just for convenience)
    const srcPoints = [[0, 0], [0, h], [w, 0], [w, h]];
    let dstPoints = [[0, 0], [0, h], [w, 0], [w, h]];
    // Create the homography object (it is not necessary to set transform as "projective" as it will be automatically detected
    const homography = new Homography(); 
    // Set the static parameters of all the transforms sequence (it will improve the performance of subsequent warpings)
    homography.setSourcePoints(srcPoints);
    homography.setImage(testImg);

    // Set the parameters for building the future dstPoints at each frame (5 movements of 50 frames each one)
    const framesPerMovement = 50;
    const movements = [[[0, h/5], [0, -h/5], [0, 0], [0, 0]],
                       [[w, 0], [w, 0], [-w, 0], [-w, 0]],
                       [[0, -h/5], [0, h/5], [0, h/5], [0, -h/5]],
                       [[-w, 0], [-w, 0], [w, 0], [w, 0]],
                       [[0, 0], [0, 0], [0, -h/5], [0, h/5]]];

    for(let movement = 0; movement<movements.length; movement++){
        for (let step = 0; step<framesPerMovement; step++){
            //Set the actual dstPoints
            for (let point = 0; point<srcPoints.length; point++){
                dstPoints[point][0] += movements[movement][point][0]/framesPerMovement;
                dstPoints[point][1] += movements[movement][point][1]/framesPerMovement;
            }
            // Update the destiny points for the new warping. 
            homography.setDestinyPoints(dstPoints);
            //const img = homography.warp()
            homography.transformHTMLElement(button)
            console.log(button)
            // Clear the canvas and draw the new image on the canvas (using putImageData instead of drawImage for performance reasons)
            //ctx.clearRect(0, 0, w, h);
            //ctx.putImageData(img, Math.min(dstPoints[0][0], dstPoints[2][0]), Math.min(dstPoints[0][1], dstPoints[2][1]));
            await new Promise(resolve => setTimeout(resolve, 10)); // Just a trick for forcing the canvas to refresh
        }
    }

}



function addTitle(title){
    let h1 = document.createElement('h1');
    h1.textContent = title;
    h1.style.textAlign = 'center';
    h1.style.width = '80%';
    document.body.appendChild(h1);
}

