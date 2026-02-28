const axios = require('axios');
const fs = require('fs');
const querystring = require('querystring');

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Použití: node explore_premium.js <uzivatelske_jmeno> <heslo>");
    process.exit(1);
}

const [username, password] = args;
const baseUrl = 'https://premium.titulky.com/';

const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
};

async function run() {
    try {
        console.log("1. Stahuji hlavní stránku pro analýzu přihlašovacího formuláře...");
        const homeRes = await axios.get(baseUrl, { headers: browserHeaders });
        fs.writeFileSync('premium_home.html', homeRes.data);
        console.log("   -> Uloženo premium_home.html");

        console.log("\n2. Zkouším se přihlásit...");
        const postData = querystring.stringify({
            Login: username,
            Password: password,
            prihlasit: 'Přihlásit',
            foreverlog: '1'
        });
        const loginRes = await axios.post(baseUrl, postData, {
            headers: { 
                ...browserHeaders,
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 400
        });

        const cookies = loginRes.headers['set-cookie'] || [];
        console.log(`   -> Získány cookies: ${cookies.length > 0 ? 'ANO' : 'NE'}`);
        fs.writeFileSync('premium_cookies.json', JSON.stringify(cookies, null, 2));

        console.log("\n3. Zkouším vyhledat 'steal'...");
        const searchRes = await axios.get(`${baseUrl}?Fulltext=steal`, {
            headers: { 
                ...browserHeaders,
                'Cookie': cookies.join('; ') 
            }
        });
        fs.writeFileSync('premium_search.html', searchRes.data);
        console.log("   -> Uloženo premium_search.html");

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
