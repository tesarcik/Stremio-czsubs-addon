const axios = require('axios');
const fs = require('fs');

async function run() {
    try {
        const cookies = JSON.parse(fs.readFileSync('premium_cookies.json', 'utf8'));
        const baseUrl = 'https://premium.titulky.com/';
        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Cookie': cookies.join('; ')
        };

        console.log("Stahuji ze zdroje: download.php?id=421520");
        const res = await axios.get(`${baseUrl}download.php?id=421520`, {
            headers: browserHeaders,
            responseType: 'stream',
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        console.log("Status:", res.status);
        console.log("Headers:", res.headers);

        let filename = 'downloaded_file';
        const contentDisposition = res.headers['content-disposition'];
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match) filename = match[1];
        }
        console.log("Saving as:", filename);

        const writer = fs.createWriteStream(filename);
        res.data.pipe(writer);

        writer.on('finish', () => {
            console.log(`Soubor úspěšně uložen jako ${filename}`);
        });

    } catch (e) {
        console.error("CHYBA:", e.message);
        if (e.response) {
            console.log("Status:", e.response.status);
            console.log("Headers:", e.response.headers);
        }
    }
}

run();
