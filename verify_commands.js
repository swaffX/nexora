const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'main-bot', 'src', 'commands');
console.log('Root:', root);

function scan(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            scan(fullPath);
        } else if (f.endsWith('.js')) {
            console.log(`Checking ${f}...`);
            try {
                const cmd = require(fullPath);
                if (!cmd) {
                    console.log(`❌ ${f}: Export is null/undefined`);
                } else if (!cmd.data) {
                    console.log(`❌ ${f}: missing 'data' export`);
                } else if (!cmd.execute) {
                    console.log(`❌ ${f}: missing 'execute' export`);
                } else {
                    console.log(`✅ ${f}: Valid (${cmd.data.name})`);
                }
            } catch (e) {
                console.log(`❌ ${f}: Require Error -> ${e.message}`);
                console.log(e.stack);
            }
        }
    }
}

try {
    scan(root);
} catch (e) {
    console.log('Fatal Error:', e);
}
