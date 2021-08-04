import { Homography , loadImage} from '../Homography.js';

const homo = new Homography('auto')
console.log(await loadImage('./testImg.png'));
homo.setImage(await loadImage('./testImg.png'));
homo.setReferencePoints([0, 0, 0, 1, 1, 1], [0, 0, 0, 1, 1, 1]);
const image = homo.warp();
console.log(image);