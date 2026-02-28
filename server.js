// server.js
const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const express = require('express');
const unzipper = require('unzipper');
const axios = require('axios');
const cheerio = require('cheerio');
const titulky = require('./titulky.js');

const PORT = process.env.PORT || 7000;

// SEM DOPLŇ SVOJI ADRESU, KTEROU TI DAL BEAMUP
const PUBLIC_URL = 'https://a5911a1ceea0-stremio-premium-czsubs.baby-beamup.club';

const manifest = {
    id: 'com.titulky.stremio-premium',
    version: '1.0.2',
    name: 'Titulky.com Premium',
    resources: ['subtitles'],
    types: ['movie', 'series'],
    config: [
        { key: "username", title: "Uživatelské jméno", type: "text", required: true },
        { key: "password", title: "Heslo", type: "password", required: true }
    ],
    behaviorHints: { configurable: true, configurationRequired: true }
};

const builder = new addonBuilder(manifest);

builder.defineSubtitlesHandler(async (args) => {
    if (!args.config?.username || !args.config?.password) return { subtitles: [] };
    const config = { username: args.config.username, password: args.config.password };

    try {
        const [imdbId, season, episode] = args.id.split(':');
        const meta = await axios.get(`https://cinemeta-live.strem.io/meta/${args.type}/${imdbId}.json`);
        let query = meta.data.meta.name;
        if (season && episode) query += ` S${season.padStart(2, '0')}E${episode.padStart(2, '0')}`;

        const cookies = await titulky.login(config);
        const searchHtml = await titulky.searchForSubtitles(query, 'CZ', cookies);

        const subtitles = [];
        const $ = cheerio.load(searchHtml);

        $('table.table-hover tbody tr').each((i, el) => {
            const detailUrl = $(el).find('td:nth-child(2) a').attr('href');
            if (detailUrl) {
                subtitles.push({
                    id: detailUrl,
                    lang: 'ces',
                    // TADY POUŽÍVÁME PEVNOU VEŘEJNOU URL
                    url: `${PUBLIC_URL}/download/${encodeURIComponent(config.username)}/${encodeURIComponent(config.password)}/${encodeURIComponent(detailUrl)}`
                });
            }
        });

        return { subtitles };
    } catch (e) {
        return { subtitles: [] };
    }
});

const app = express();

// CORS HLAVIČKY - DŮLEŽITÉ PRO PROHLÍŽEČ
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

app.get('/download/:username/:password/:detailUrl', async (req, res) => {
    try {
        const cookies = await titulky.login({
            username: decodeURIComponent(req.params.username),
            password: decodeURIComponent(req.params.password)
        });
        const stream = await titulky.getSubtitleStream(decodeURIComponent(req.params.detailUrl), cookies);

        res.setHeader('Content-Type', 'text/vtt'); // Stremio má rádo VTT/SRT

        stream.pipe(unzipper.Parse())
            .on('entry', entry => {
                if (entry.path.endsWith('.srt') || entry.path.endsWith('.sub')) {
                    entry.pipe(res);
                } else {
                    entry.autodrain();
                }
            });
    } catch (e) {
        res.status(500).end();
    }
});

app.use(getRouter(builder.getInterface()));
app.listen(PORT);