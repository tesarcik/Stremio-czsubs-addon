// titulky.js - Premium Version

const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://premium.titulky.com/';

const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
};

async function login(credentials) {
    console.log('[LOGIN] Zahajuji přihlášení na premium server...');
    try {
        const postData = querystring.stringify({
            LoginName: credentials.username,
            LoginPassword: credentials.password,
            PermanentLog: '148'
        });
        const response = await axios.post(baseUrl, postData, {
            headers: {
                ...browserHeaders,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        if (response.headers['set-cookie']) {
            console.log('[LOGIN] Přihlášení úspěšné.');
            return response.headers['set-cookie'];
        }
        throw new Error('Server nevrátil cookies.');
    } catch (error) {
        console.error('[LOGIN] CHYBA:', error.message);
        return null;
    }
}

async function searchForSubtitles(title, langFilter, cookies) {
    console.log(`[SEARCH] Zahajuji vyhledávání pro: "${title}" (Jazyk: ${langFilter})`);
    try {
        const searchUrl = `${baseUrl}?action=search&Fulltext=${encodeURIComponent(title)}&Jazyk=${langFilter}`;
        const response = await axios.get(searchUrl, {
            headers: {
                ...browserHeaders,
                'Cookie': cookies.join('; ')
            }
        });
        console.log('[SEARCH] Vyhledávání úspěšné.');
        return response.data;
    } catch (error) {
        console.error('[SEARCH] CHYBA:', error.message);
        return null;
    }
}

async function getSubtitleStream(detailPageUrl, cookies) {
    console.log(`[DOWNLOAD] Převádím ${detailPageUrl} na přímé stažení ZIPu...`);
    try {
        let urlToCheck = detailPageUrl;
        if (!urlToCheck.startsWith('http')) {
            urlToCheck = baseUrl + (urlToCheck.startsWith('/') ? urlToCheck.substring(1) : urlToCheck);
        }

        const urlParams = new URL(urlToCheck).searchParams;
        const id = urlParams.get('id');

        if (!id) throw new Error('Nedokážu najít ID v odkazu detailu titulků');

        const downloadUrl = `${baseUrl}download.php?id=${id}`;
        console.log(`[Krok 1] Stahuji ZIP archiv z: ${downloadUrl}`);

        const baseHeaders = {
            ...browserHeaders,
            'Cookie': cookies.join('; '),
            'Referer': baseUrl
        };

        const fileResponse = await axios.get(downloadUrl, {
            headers: baseHeaders,
            responseType: 'stream',
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        if (fileResponse.headers['content-type'] && fileResponse.headers['content-type'].includes('zip')) {
            console.log('[DOWNLOAD] Úspěšně získáno (ZIP), vracím stream...');
            return fileResponse.data;
        } else {
            console.log("[DOWNLOAD DEBUG] Status:", fileResponse.status, "Content-Type:", fileResponse.headers['content-type']);
            throw new Error('Finální odpověď serveru nebyla ZIP soubor (např. chyba prémiového limitu?).');
        }
    } catch (error) {
        console.error(`[DOWNLOAD] CHYBA v procesu stahování: ${error.message}`);
        return null;
    }
}

module.exports = {
    login,
    searchForSubtitles,
    getSubtitleStream
};