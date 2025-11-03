// titulky.js - Version 9.0 (DEBUG)

const axios = require('axios');
const querystring = require('querystring');
const cheerio = require('cheerio');
const fs = require('fs'); 
const path = require('path');

const baseUrl = 'https://www.titulky.com/';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
};

async function login(credentials) {
    console.log('[LOGIN] Zahajuji přihlášení...');
    try {
        const postData = querystring.stringify({
            Login: credentials.username,    
            Password: credentials.password,
            prihlasit: 'Přihlásit',
            foreverlog: '1' 
        });
        const response = await axios.post(baseUrl, postData, {
            headers: { 
                ...browserHeaders, 
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.status === 200 && response.headers['set-cookie']) {
            console.log('[LOGIN] Přihlášení úspěšné.');
            return response.headers['set-cookie'];
        }
        throw new Error('Server nevrátil cookies.');
    } catch (error) {
        console.error('[LOGIN] CHYBA:', error.message);
        return null;
    }
}

async function searchForSubtitles(title, cookies) {
    console.log(`[SEARCH] Zahajuji vyhledávání pro: "${title}"`);
    try {
        const searchUrl = `${baseUrl}?Fulltext=${encodeURIComponent(title)}`;
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
    console.log(`[DOWNLOAD] Zahajuji proces stahování z: ${detailPageUrl}`);
    try {
        const baseHeaders = { 
            ...browserHeaders, 
            'Cookie': cookies.join('; '), 
            'Referer': baseUrl 
        };
        
        console.log('[Krok 1] Stahuji hlavní stránku detailu...');
        const detailResponse = await axios.get(detailPageUrl, { headers: baseHeaders });
        const pageHtml = detailResponse.data; 
        let $ = cheerio.load(pageHtml);

        let intermediaryUrl = '';

        console.log('[Krok 2] Hledám přímý odkaz <a> [href*="idown.php"] nebo [href*="iframedownload.php"]...');
        let linkElement = $('a[href*="idown.php"], a[href*="iframedownload.php"]');

        if (linkElement.length > 0) {
            console.log('[Krok 2] Přímý odkaz <a> nalezen.');
            intermediaryUrl = `${baseUrl}${linkElement.first().attr('href')}`;
        } else {

        }

        console.log(`[Krok 3] Stahuji mezistránku: ${intermediaryUrl}`);
        const intermediaryHeaders = { ...baseHeaders, 'Referer': detailPageUrl };
        const intermediaryResponse = await axios.get(intermediaryUrl, { headers: intermediaryHeaders });
        
        const intermediaryHtml = intermediaryResponse.data;
        $ = cheerio.load(intermediaryHtml);

        console.log('[Krok 4] Hledám formulář [name="download"] (Typ 1)...');
        const downloadForm = $('form[name="download"]');
        
        if (downloadForm.length > 0) {
            console.log('[Krok 4] Nalezen formulář (Typ 1). Zpracovávám...');

            const actionUrl = downloadForm.attr('action');
            const inputs = {};
            downloadForm.find('input[type="hidden"]').each((i, el) => {
                const name = $(el).attr('name');
                const value = $(el).attr('value');
                if (name && value) { inputs[name] = value; }
            });
            if (!actionUrl || Object.keys(inputs).length === 0) throw new Error('Formulář (Typ 1) je nekompletní.');
            const downloadPostData = querystring.stringify(inputs);
            const downloadUrl = `${baseUrl}${actionUrl}`; 
            const timer = 5000; 
            console.log(`[Krok 5] Čekám ${timer / 1000}s (simulace časovače)...`);
            await delay(timer);
            console.log(`[Krok 6] Posílám finální POST požadavek na: ${downloadUrl}`);
            const fileResponse = await axios.post(downloadUrl, downloadPostData, {
                headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': intermediaryUrl },
                responseType: 'stream' 
            });
            if (fileResponse.status === 200 && fileResponse.headers['content-disposition']) {
                console.log('[DOWNLOAD] Úspěšně získáno (Typ 1), vracím stream...');
                return fileResponse.data;
            } else {
                throw new Error('Finální odpověď serveru (Typ 1) neobsahovala soubor.');
            }

        } else {
            console.log('[Krok 4] Formulář (Typ 1) nenalezen. Hledám link (Typ 2) pomocí Regexu...');
            const regex = /(\/idown\.php\?id=\d+)/;
            const match = intermediaryHtml.match(regex);

            if (match && match[1]) {
                console.log('[Krok 4] Nalezen finální odkaz (Typ 2) pomocí Regex.');
                const finalHref = match[1];
                const finalDownloadUrl = `${baseUrl}${finalHref}`;
                console.log(`[Krok 5] Není třeba čekat. Stahuji přímo z: ${finalDownloadUrl}`);
                const fileResponse = await axios.get(finalDownloadUrl, {
                    headers: { ...baseHeaders, 'Referer': intermediaryUrl },
                    responseType: 'stream'
                });
                if (fileResponse.status === 200 && fileResponse.headers['content-disposition']) {
                    console.log('[DOWNLOAD] Úspěšně získáno (Typ 2), vracím stream...');
                    return fileResponse.data;
                } else {
                    throw new Error('Finální odpověď serveru (Typ 2) neobsahovala soubor.');
                }
            } else {
                console.error('[Krok 4] CHYBA: Na mezistránce nebyl nalezen ani formulář ');
                throw new Error('Nepodařilo se najít finální odkaz ke stažení na mezistránce.');
            }
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