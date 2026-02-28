const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

let serverProcess;

async function testStremioServer() {
    console.log("=== Testing Stremio Server Endpoints ===");

    const config = { username: process.argv[2], password: process.argv[3] };
    const configStr = encodeURIComponent(JSON.stringify(config));
    const baseUrl = `http://127.0.0.1:7000/${configStr}`;

    console.log("1. Fetching manifest from", baseUrl + '/manifest.json');
    try {
        const manifest = await axios.get(baseUrl + '/manifest.json');
        console.log("Manifest fetched successfully.");

        console.log("2. Fetching subtitles for Bridgerton S04E08 (tt8740790:4:8)...");
        // We know Bridgerton ID is tt8740790
        const subtitlesRes = await axios.get(`${baseUrl}/subtitles/series/tt8740790%3A4%3A8.json`);

        const subs = subtitlesRes.data.subtitles;
        console.log(`Found ${subs ? subs.length : 0} subtitles.`);

        if (subs && subs.length > 0) {
            const firstSub = subs[0];
            console.log(`3. Downloading subtitle from: ${firstSub.url}`);

            const downloadRes = await axios.get(firstSub.url, { responseType: 'stream', maxRedirects: 0 });
            console.log(`Download response status: ${downloadRes.status}`);
            console.log(`Content-Type: ${downloadRes.headers['content-type']}`);

            const writer = fs.createWriteStream('test_output.srt');
            downloadRes.data.pipe(writer);

            writer.on('finish', () => {
                console.log("Successfully downloaded and extracted subtitle to test_output.srt");
                serverProcess.kill();
                process.exit(0);
            });
            writer.on('error', (err) => {
                console.error("Error writing file:", err);
                serverProcess.kill();
                process.exit(1);
            });

        } else {
            console.log("No subtitles found. Test failed.");
            serverProcess.kill();
            process.exit(1);
        }

    } catch (e) {
        console.error("Test failed:", e.message);
        if (e.response && e.response.data) {
            console.log(e.response.data);
        }
        serverProcess.kill();
        process.exit(1);
    }
}

serverProcess = spawn('node', ['server.js']);
serverProcess.stdout.on('data', data => console.log('SERVER:', data.toString().trim()));
serverProcess.stderr.on('data', data => console.error('SERVER ERR:', data.toString().trim()));

setTimeout(testStremioServer, 3000);
