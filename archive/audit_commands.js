const fs = require('fs');
const path = require('path');

const commandsPath = path.join(__dirname, 'main-bot', 'src', 'commands');
const commandFolders = fs.readdirSync(commandsPath);

let total = 0;
const names = new Set();
const details = [];

console.log('--- Command Audit ---');

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const stat = fs.statSync(folderPath);

    if (stat.isDirectory()) {
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                const cmd = require(path.join(folderPath, file));
                const hasData = 'data' in cmd;
                const hasExecute = 'execute' in cmd;

                if (hasData && hasExecute) {
                    const name = cmd.data.name;
                    if (names.has(name)) {
                        console.log(`[DUPLICATE] ${folder}/${file} defines command '${name}' which already exists!`);
                    } else {
                        names.add(name);
                        details.push(`${folder}/${file} -> ${name}`);
                    }
                    total++;
                } else {
                    console.log(`[INVALID] ${folder}/${file} missing data or execute export.`);
                }
            } catch (e) {
                console.log(`[ERROR] Could not load ${folder}/${file}: ${e.message}`);
            }
        }
    }
}

console.log(`\nFound ${total} valid commands.`);
console.log('--- Valid Commands List ---');
console.log(details.join('\n'));
