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
            return response.headers['set-cookie'];
        }
        throw new Error('Server nevrátil cookies.');
    } catch (error) {
        console.error('[LOGIN] CHYBA:', error.message);
        return null;
    }
}

async function searchForSubtitles(title, langFilter, cookies) {
    try {
        const searchUrl = `${baseUrl}?action=search&Fulltext=${encodeURIComponent(title)}&Jazyk=${langFilter}`;
        const response = await axios.get(searchUrl, {
            headers: {
                ...browserHeaders,
                'Cookie': cookies.join('; ')
            }
        });
        return response.data;
    } catch (error) {
        console.error('[SEARCH] CHYBA:', error.message);
        return null;
    }
}

async function getSubtitleStream(detailPageUrl, cookies) {
    try {
        let urlToCheck = detailPageUrl;
        if (!urlToCheck.startsWith('http')) {
            urlToCheck = baseUrl + (urlToCheck.startsWith('/') ? urlToCheck.substring(1) : urlToCheck);
        }

        const urlParams = new URL(urlToCheck).searchParams;
        const id = urlParams.get('id');

        if (!id) throw new Error('Nedokážu najít ID v odkazu detailu titulků');

        const downloadUrl = `${baseUrl}download.php?id=${id}`;

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
            return fileResponse.data;
        } else {
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