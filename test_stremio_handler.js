const builderModule = require('./server.js'); // Assuming we can get builder
const titulky = require('./titulky.js');
const fs = require('fs');

async function test() {
    console.log("=== Test subtitles handler ===");

    // Test args
    const args = {
        type: 'series',
        id: 'tt8740790:4:8', // Bridgerton S04E08
        config: {
            username: process.argv[2],
            password: process.argv[3]
        }
    };

    if (!args.config.username || !args.config.password) {
        console.error("Please provide username and password as args");
        process.exit(1);
    }

    // Since server.js exports nothing directly and starts a server.
    console.log("Test starts... but we need the actual handler function from server.js");
}

test();
