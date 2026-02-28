const axios = require('axios');
const fs = require('fs');
const querystring = require('querystring');

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Použití: node explore_premium2.js <uzivatelske_jmeno> <heslo>");
    process.exit(1);
}

const [username, password] = args;
const baseUrl = 'https://premium.titulky.com/';

const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
};

async function run() {
    try {
        console.log("1. Zkouším se přihlásit s novými políčky (LoginName, LoginPassword)...");
        const postData = querystring.stringify({
            LoginName: username,
            LoginPassword: password,
            PermanentLog: '148'
        });
        const loginRes = await axios.post(baseUrl, postData, {
            headers: {
                ...browserHeaders,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        let cookies = loginRes.headers['set-cookie'] || [];
        // If it was a redirect (302), it means login might have succeeded.
        console.log(`   -> Získány cookies: ${cookies.length > 0 ? 'ANO' : 'NE'}`);
        fs.writeFileSync('premium_cookies.json', JSON.stringify(cookies, null, 2));

        console.log("\n2. Zkouším vyhledat 'steal'...");
        const searchRes = await axios.get(`${baseUrl}?action=search&Fulltext=steal`, {
            headers: {
                ...browserHeaders,
                'Cookie': cookies.join('; ')
            }
        });
        fs.writeFileSync('premium_search.html', searchRes.data);
        console.log("   -> Uloženo premium_search.html");

        console.log("\n3. Zkouším stáhnout stránku s detailem (pokus naslepo na id 421520)...");
        // We know from the previous HTML that Bridgerton has ID 421520
        const detailRes = await axios.get(`${baseUrl}?action=detail&id=421520`, {
            headers: {
                ...browserHeaders,
                'Cookie': cookies.join('; ')
            }
        });
        fs.writeFileSync('premium_detail.html', detailRes.data);
        console.log("   -> Uloženo premium_detail.html");

        console.log("\nHOTOVO! Můžete mi napsat, že script doběhl.");
    } catch (e) {
        console.error("CHYBA:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            fs.writeFileSync('premium_error.html', e.response.data);
            console.log("Uloženo premium_error.html");
        }
    }
}

run();
