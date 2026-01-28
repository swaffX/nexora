const fs = require('fs');
const path = require('path');

const targetDirs = ['main-bot', 'supervisor-bot'];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (file !== 'node_modules') {
                arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.js')) {
                arrayOfFiles.push(path.join(dirPath, file));
            }
        }
    });

    return arrayOfFiles;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Check for ephemeral: true
    if (content.includes('ephemeral: true')) {
        console.log(`Processing: ${filePath}`);

        // Replace
        content = content.replace(/ephemeral:\s*true/g, 'flags: MessageFlags.Ephemeral');

        // Check if MessageFlags is available
        if (!content.includes('MessageFlags')) {
            // Need to import it.
            // Check for existing discord.js import
            const discordImportRegex = /const\s+({[\s\S]*?})\s*=\s*require\(['"]discord\.js['"]\)/;
            const match = content.match(discordImportRegex);

            if (match) {
                // Destructured import exists
                let destructured = match[1];
                if (!destructured.includes('MessageFlags')) {
                    // Add it
                    // Handle multiline or single line
                    if (destructured.includes('\n')) {
                        // Multiline
                        const newDestructured = destructured.replace(/}$/, ', MessageFlags }');
                        content = content.replace(destructured, newDestructured);
                    } else {
                        // Single line
                        const newDestructured = destructured.replace(/}$/, ', MessageFlags }');
                        content = content.replace(destructured, newDestructured);
                    }
                }
            } else {
                // No destructured import found (maybe 'const Discord = ...' or no import)
                // Just add it to the top
                // Find first require or 'use strict'
                const firstRequire = content.indexOf('require(');
                if (firstRequire !== -1) {
                    // Find the end of this line
                    const endOfLine = content.indexOf('\n', firstRequire);
                    const insertPos = endOfLine + 1;
                    content = content.slice(0, insertPos) + "const { MessageFlags } = require('discord.js');\n" + content.slice(insertPos);
                } else {
                    // Start of file
                    content = "const { MessageFlags } = require('discord.js');\n" + content;
                }
            }
        } else {
            // MessageFlags exists in usage, but maybe not imported? 
            // If we just replaced it, 'MessageFlags' string is now in content.
            // We need to check if it was DEFINED before.
            // A simple heuristic: check if it appears in a require line `MessageFlags } =` or `MessageFlags,`
            const isImported = /MessageFlags\s*[},]/.test(content) || /const\s+MessageFlags\s+=/.test(content);

            if (!isImported) {
                // Try to add import similar to above logic
                const discordImportRegex = /const\s+({[\s\S]*?})\s*=\s*require\(['"]discord\.js['"]\)/;
                const match = content.match(discordImportRegex);

                if (match) {
                    let destructured = match[1];
                    if (!destructured.includes('MessageFlags')) {
                        const newDestructured = destructured.replace(/}$/, ', MessageFlags }');
                        content = content.replace(destructured, newDestructured);
                    }
                } else {
                    // Add new import line
                    const firstRequire = content.indexOf('require(');
                    if (firstRequire !== -1) {
                        const endOfLine = content.indexOf('\n', firstRequire);
                        const insertPos = endOfLine + 1;
                        content = content.slice(0, insertPos) + "const { MessageFlags } = require('discord.js');\n" + content.slice(insertPos);
                    } else {
                        content = "const { MessageFlags } = require('discord.js');\n" + content;
                    }
                }
            }
        }
    }

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function run() {
    for (const dir of targetDirs) {
        const fullPath = path.join(__dirname, dir);
        if (fs.existsSync(fullPath)) {
            const files = getAllFiles(fullPath);
            files.forEach(file => processFile(file));
        } else {
            console.log(`Directory not found: ${fullPath}`);
        }
    }
}

run();
