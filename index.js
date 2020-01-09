const PromisePool = require("es6-promise-pool");
const path = require('path');

const fs = require('fs');
const ytdl = require('ytdl-core');
const util = require('util')
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');



var downloadPath = path.join(__dirname, "download");

const youtubeUrls = JSON.parse(fs.readFileSync('./video_list.json'));

console.log(youtubeUrls.length + " video audios are going to be downloaded.")

const promiseGetInfo = util.promisify(ytdl.getInfo);

const generatePromises = function* () {
    for (let url of youtubeUrls) {
        console.log("Add URL to the queue " + url);
        yield downloadMp3(url, downloadPath)
    }
}

const pool = new PromisePool(generatePromises, 20);

main();

async function main() {

    for (let url of youtubeUrls) {

        console.log("Video URL: " + url);
    }

    await pool.start();

}

function downloadMp3(url, path) {
    return new Promise(async (resolve, reject) => {

        const videoInfo = await promiseGetInfo(url)

        //let audioFormats = ytdl.filterFormats(videoInfo.formats, 'audioonly');
        const filename = videoInfo.title.replace(/[/\\?%*:|"<>]/g, '-');
        const filePath = downloadPath + "/" + filename;

        if(fs.existsSync(filePath + ".mp3")) {
            console.log("Skipping " + videoInfo.title + " (already exists) ")
            resolve();
            return;
        }  

        const fstream = fs.createWriteStream(filePath);

        const stream = ytdl(url, { filter: 'audioonly' }).pipe(fstream);
        stream.on("open", () => console.log("Downloading " + videoInfo.title + " url: " + url));

        fstream.on("data", () => console.log("Data for: " + videoInfo.title))

        stream.on("finish", async (e) => {
            try {
                console.log("Converting " + videoInfo.title + " to mp3 ... ");
                await convertToMp3(filePath, "webm");
                console.log(videoInfo.title + " downloaded successfully")
            } catch(e) {
                console.log(e);
            }
            resolve();
        })

        stream.on("error", (e) => reject(e));

    })
}


function convertToMp3(filePath, extension) {
    return new Promise((resolve, reject) => {
        const proc = new ffmpeg({ source: filePath });

        if (os.platform() === 'win32') {
            proc.setFfmpegPath("./ffmpeg/bin/ffmpeg.exe");
        } else {
            // For linux
        }

        proc.toFormat("mp3");

        proc.on("end", (e) => {
            fs.unlinkSync(filePath);
            resolve() 
        });

        proc.on("error", (e) => reject(e));

        proc.saveToFile(filePath + ".mp3");
    });
}

