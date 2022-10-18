// Import the Homography class and the loadImage function 
import { Homography } from '../Homography.js';

// Define the source and destiny points
const sourcePoints = [[0, 0], [0, 1], [1, 0], [1, 1]];
const dstPoints = [[1/10, 1/2], [0, 1], [9/10, 1/2], [1, 1]];
// Create the homography object and set the reference points
const homography = new Homography()
homography.setReferencePoints(sourcePoints, dstPoints);
// Here, in backend we can use `await loadImage(<img_path>)` instead of an HTMLImageElement 
homography.setImage(await loadImage('./testImgLogoBlack.png'));
// And when warping, we get a pngImage from the 'pngjs' package instead of an ImageData
const pngImage = homography.warp();