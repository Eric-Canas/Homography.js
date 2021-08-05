module.exports = {
    entry: './Homography.js',
    output : {
        path : __dirname,
        filename : 'HomographyLightweight.min.js',
        
        library: {
            name : "homography",
            type : "umd"
        },
        }
}