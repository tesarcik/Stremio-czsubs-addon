const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const unzipper = require('unzipper');
const titulky = require('./titulky.js');

const PORT = process.env.PORT || 7000;

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

let dynamicBaseUrl = `http://127.0.0.1:${PORT}`;

builder.defineSubtitlesHandler(async (args) => {
    console.log('\n--- (1) POŽADAVEK NA SEZNAM TITULKŮ ---');
    console.log('Přijata data od Stremia:', args.id);
    console.log('Základní URL (dynamicBaseUrl):', dynamicBaseUrl);

    if (!args.config || !args.config.username || !args.config.password) {
        console.log('Chybí konfigurace. Uživatel musí zadat jméno a heslo.');
        return { subtitles: [] };
    }
    const config = { username: args.config.username, password: args.config.password };
    try {
        let movieName = '';
        const [imdbId, season, episode] = args.id.split(':');
        const metaUrl = `https://cinemeta-live.strem.io/meta/${args.type}/${imdbId}.json`;
        console.log(`[KROK 1] Získávám název z: ${metaUrl}`);
        const response = await axios.get(metaUrl);
        movieName = response.data.meta.name;

        let searchQuery = movieName;
        if (season && episode) {
            searchQuery = `${movieName} S${season.padStart(2, '0')}E${episode.padStart(2, '0')}`;
        }
        console.log(`[KROK 1] Vyhledávací dotaz: "${searchQuery}"`);

        console.log('[KROK 2] Přihlašuji se na prémiové titulky.com...');
        const cookies = await titulky.login(config);
        if (!cookies) { throw new Error('Přihlášení selhalo'); }
        console.log('[KROK 2] Přihlášení úspěšné.');

        console.log('[KROK 3] Hledám titulky pro film (CZ i SK)...');
        const [searchHtmlCZ, searchHtmlSK] = await Promise.all([
            titulky.searchForSubtitles(searchQuery, 'CZ', cookies),
            titulky.searchForSubtitles(searchQuery, 'SK', cookies)
        ]);
        console.log('[KROK 3] HTML s výsledky obou jazyků přijato.');

        const subtitles = [];

        const processHtml = (html, langCode) => {
            if (!html) return;
            const $ = cheerio.load(html);
            $('table.table-hover tbody tr').each((i, el) => {
                const row = $(el);
                const linkElement = row.find('td:nth-child(2) a');
                if (linkElement.length > 0) {
                    const detailUrl = linkElement.attr('href');
                    const linkText = linkElement.text().toLowerCase().trim();
                    const titleSimple = searchQuery.toLowerCase().trim();

                    if (linkText.includes(titleSimple.split(' ')[0])) {
                        subtitles.push({
                            id: detailUrl,
                            lang: langCode,
                            url: `${dynamicBaseUrl}/download/${encodeURIComponent(config.username)}/${encodeURIComponent(config.password)}/${encodeURIComponent(detailUrl)}`
                        });
                    }
                }
            });
        };

        processHtml(searchHtmlCZ, 'ces');
        processHtml(searchHtmlSK, 'slk');

        console.log(`[KROK 4] Nalezeno ${subtitles.length} titulků (po odfiltrování).`);
        return { subtitles };
    } catch (error) {
        console.error('!!! CHYBA V SUBTITLES HANDLERU !!!', error.message);
        return { subtitles: [] };
    }
});

const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // --- OPRAVA PRO BEAMUP ---
    const host = req.get('host');
    const proto = req.headers['x-forwarded-proto'] || req.protocol;

    // Pokud hostitel obsahuje "baby-beamup.club", použijeme ho. 
    // Pokud je to to divné ID "a5911...", přepíšeme ho na správnou subdoménu.
    if (host.includes('baby-beamup.club') || host.includes('a5911a1ceea0')) {
        dynamicBaseUrl = `${proto}://a5911a1ceea0-stremio-premium-czsubs.baby-beamup.club`;
    } else {
        dynamicBaseUrl = `${proto}://${host}`;
    }
    // -------------------------

    next();
});

app.get('/configure', (req, res) => {
    res.sendFile(path.join(__dirname, 'configure.html'));
});

app.get('/', (req, res) => {
    res.redirect('/configure');
});

app.get('/download/:username/:password/:detailUrl', async (req, res) => {
    console.log('\n--- (2) POŽADAVEK NA STAŽENÍ KONKRÉTNÍCH TITULKŮ ---');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    try {
        const userConfig = {
            username: decodeURIComponent(req.params.username),
            password: decodeURIComponent(req.params.password)
        };
        const cookies = await titulky.login(userConfig);
        if (!cookies) { throw new Error('Přihlášení selhalo před stažením'); }

        const subtitleStream = await titulky.getSubtitleStream(decodeURIComponent(req.params.detailUrl), cookies);
        if (!subtitleStream) { throw new Error('Funkce getSubtitleStream nevrátila stream'); }

        res.setHeader('Content-Type', 'application/x-subrip');

        let subtitleFound = false;
        subtitleStream.pipe(unzipper.Parse())
            .on('entry', function (entry) {
                const fileName = entry.path;
                const type = entry.type;
                if (!subtitleFound && type === 'File' && (fileName.endsWith('.srt') || fileName.endsWith('.sub') || fileName.endsWith('.txt'))) {
                    subtitleFound = true;
                    entry.pipe(res);
                } else {
                    entry.autodrain();
                }
            })
            .on('error', (err) => {
                if (!res.headersSent) res.status(500).send('Chyba při rozbalování ZIPu');
            });
    } catch (e) {
        res.status(500).send('Chyba na straně serveru');
    }
});

const router = getRouter(builder.getInterface());
app.use(router);

app.listen(PORT, () => {
    console.log(`Server běží na portu ${PORT}`);
});