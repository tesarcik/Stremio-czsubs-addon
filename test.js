require('dotenv').config();
const titulky = require('./titulky.js');

const myCredentials = {
    username: process.env.TITULKY_USERNAME,
    password: process.env.TITULKY_PASSWORD
};

async function test() {
    try {
        console.log("Přihlašuji se...");
        const cookies = await titulky.login(myCredentials);
        if (!cookies) throw new Error("Přihlášení selhalo.");

        console.log("Hledám titulky pro 'The Other Bennet Sister S01E01'...");
        const html = await titulky.searchForSubtitles('The Other Bennet Sister S01E01', 'CZ', cookies);

        const cheerio = require('cheerio');
        const $ = cheerio.load(html);

        console.log("Nalezené řádky:", $('table.table-hover tbody tr').length);
        $('table.table-hover tbody tr').each((i, el) => {
            const row = $(el);
            const linkElement = row.find('td:nth-child(2) a');
            const link = linkElement.attr('href');
            const text = linkElement.text().trim();
            console.log(`[${i}] ${text} -> ${link}`);
        });

        // Find first valid detail URL
        let firstLink = null;
        $('table.table-hover tbody tr').each((i, el) => {
            const row = $(el);
            const linkElement = row.find('td:nth-child(2) a');
            const href = linkElement.attr('href');
            if (href && !href.startsWith('javascript:')) {
                firstLink = href;
                return false; // break loop
            }
        });

        if (!firstLink) {
            console.log("Nenašel jsem platný odkaz na titulky. Stránka vrácená serverem:");
            console.log(html.substring(0, 1000));
            return;
        }

        console.log("Našel jsem odkaz:", firstLink);

        console.log("Zkouším získat stream...");
        const stream = await titulky.getSubtitleStream(`https://www.titulky.com/${firstLink}`, cookies);
        if (stream) {
            console.log("Stream úspěšně získán! Ukládám do souboru test_subtitles.srt...");
            const fs = require('fs');
            const writer = fs.createWriteStream('test_subtitles.srt');
            stream.pipe(writer);
            writer.on('finish', () => {
                console.log("Hotovo! Soubor test_subtitles.srt byl uložen.");
            });
            writer.on('error', (err) => {
                console.error("Chyba při ukládání souboru:", err);
            });
        } else {
            console.log("Při získávání streamu došlo k chybě (bot protection?).");
        }

    } catch (e) {
        console.error("Test selhal:", e.message);
    }
}

test();
