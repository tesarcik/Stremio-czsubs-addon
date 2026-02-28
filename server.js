const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const titulky = require('./titulky.js');

const PORT = process.env.PORT || 7000;

// Removed hardcoded credentials

const manifest = {
    id: 'com.titulky.stremio-addon.static-test',
    version: '1.0.1',
    name: 'Titulky.com (Testovací verze)',
    description: 'Vyhledávání českých a slovenských titulků na serveru Titulky.com.',
    logo: 'https://www.titulky.com/favicon-tecko.ico',
    resources: ['subtitles'],
    types: ['movie', 'series'],
    catalogs: [],
    config: [
        {
            key: "username",
            title: "Titulky.com Uživatelské jméno",
            type: "text",
            required: true
        },
        {
            key: "password",
            title: "Titulky.com Heslo",
            type: "password",
            required: true
        }
    ],
    behaviorHints: {
        configurable: true,
        configurationRequired: true
    }
};

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async (args) => {
    console.log('\n--- (1) POŽADAVEK NA SEZNAM TITULKŮ ---');
    console.log('Přijata data od Stremia:', args.id);

    if (!args.config || !args.config.username || !args.config.password) {
        console.log('Chybí konfigurace. Uživatel musí zadat jméno a heslo.');
        return { subtitles: [] };
    }
    const config = { username: args.config.username, password: args.config.password };
    try {
        let movieName = '';
        const imdbId = args.id.split(':')[0];
        const metaUrl = `https://cinemeta-live.strem.io/meta/${args.type}/${imdbId}.json`;
        console.log(`[KROK 1] Získávám název z: ${metaUrl}`);
        const response = await axios.get(metaUrl);
        movieName = response.data.meta.name;
        console.log(`[KROK 1] Název získán: "${movieName}"`);

        console.log('[KROK 2] Přihlašuji se na titulky.com...');
        const cookies = await titulky.login(config);
        if (!cookies) { throw new Error('Přihlášení na titulky.com selhalo'); }
        console.log('[KROK 2] Přihlášení úspěšné.');

        console.log('[KROK 3] Hledám titulky pro film...');
        const searchHtml = await titulky.searchForSubtitles(movieName, cookies);
        if (!searchHtml) { throw new Error('Vyhledávání titulků selhalo'); }
        console.log('[KROK 3] HTML s výsledky přijato.');

        const $ = cheerio.load(searchHtml);
        const subtitles = [];
        const addonUrl = `http://127.0.0.1:${PORT}`;

        $('table.soupis tr').each((i, el) => {
            const row = $(el);
            const linkElement = row.find('td:first-child a');
            const langElement = row.find('td img[alt="CZ"], td img[alt="SK"]');
            const linkText = linkElement.text().toLowerCase().trim();
            const movieNameSimple = movieName.toLowerCase().trim();

            if (linkElement.length > 0 && langElement.length > 0 && linkText.startsWith(movieNameSimple)) {
                const detailUrl = linkElement.attr('href');
                const lang = langElement.attr('alt').toLowerCase() === 'cz' ? 'ces' : 'slk';

                subtitles.push({
                    id: detailUrl,
                    lang: lang,
                    url: `${addonUrl}/download/${encodeURIComponent(config.username)}/${encodeURIComponent(config.password)}/${encodeURIComponent(detailUrl)}`
                });
            }
        });

        console.log(`[KROK 4] Nalezeno ${subtitles.length} titulků (po odfiltrování).`);
        return { subtitles };
    } catch (error) {
        console.error('!!! CHYBA V SUBTITLES HANDLERU !!!', error.message);
        return { subtitles: [] };
    }
});

const app = express();

// Serve simple configuration page
app.get('/configure', (req, res) => {
    res.sendFile(path.join(__dirname, 'configure.html'));
});

// Endpoint
app.get('/download/:username/:password/:detailUrl', async (req, res) => {
    console.log('\n--- (2) POŽADAVEK NA STAŽENÍ KONKRÉTNÍCH TITULKŮ ---');
    console.log('Požadovaný soubor:', decodeURIComponent(req.params.detailUrl));

    try {
        const userConfig = {
            username: decodeURIComponent(req.params.username),
            password: decodeURIComponent(req.params.password)
        };
        const cookies = await titulky.login(userConfig);
        if (!cookies) { throw new Error('Přihlášení selhalo před stažením'); }

        const subtitleStream = await titulky.getSubtitleStream(`https://www.titulky.com/${decodeURIComponent(req.params.detailUrl)}`, cookies);
        if (!subtitleStream) { throw new Error('Funkce getSubtitleStream nevrátila stream'); }

        console.log('Streamuji titulky do Stremia...');
        res.setHeader('Content-Type', 'application/x-subrip');
        subtitleStream.pipe(res);
    } catch (e) {
        console.error('!!! CHYBA PŘI STAHOVÁNÍ !!!', e.message);
        res.status(500).send('Chyba na straně serveru');
    }
});

const router = getRouter(builder.getInterface());
app.use(router);

app.listen(PORT, () => {
    console.log(`Server běží! Nainstalujte doplněk do Stremia pomocí adresy:`);
    console.log(`http://127.0.0.1:${PORT}/manifest.json`);
});