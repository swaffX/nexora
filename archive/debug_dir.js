const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'main-bot', 'src', 'commands');
console.log('Root:', root);
const folders = fs.readdirSync(root);
console.log('Folders:', folders);

for (const f of folders) {
    const p = path.join(root, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
        const files = fs.readdirSync(p);
        console.log(`Contents of ${f}:`, files);
    } else {
        console.log(`File in root: ${f}`);
    }
}
