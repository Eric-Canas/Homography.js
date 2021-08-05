module.exports = {
    entry: './Homography.js',
    output : {
        path : __dirname,
        filename : 'output.js',
        
        library: {
            name : "homography",
            type : "umd"
        },
        }
}