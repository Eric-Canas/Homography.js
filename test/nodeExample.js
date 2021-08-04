import { Homography , loadImage} from '../Homography.js';
import fs from 'fs';

const sourcePoints = [[0, 0], [0, 1], [1, 0], [1, 1]];
const dstPoints = [[0, 0], [0.1, 2/3], [1, 0], [1, 2/3]]
const homography = new Homography('auto')
homography.setReferencePoints(sourcePoints, dstPoints);
homography.setImage(await loadImage('./testImgLogoBlack.png'));
const pngImage = homography.warp();
pngImage.pipe(fs.createWriteStream("transformedImage.png"))