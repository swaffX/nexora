const fs = require('fs');
const path = require('path');

// Tüm .js dosyalarını bul
function findJsFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && item !== 'node_modules') {
            findJsFiles(fullPath, files);
        } else if (item.endsWith('.js') && !item.includes('fix-imports')) {
            files.push(fullPath);
        }
    }
    return files;
}

// Dosya içeriğini düzelt
function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Göreceli shared yollarını bul ve düzelt
    const patterns = [
        /require\(['"`](\.\.\/)+shared\/([^'"`]+)['"`]\)/g
    ];

    let modified = false;

    for (const pattern of patterns) {
        if (pattern.test(content)) {
            modified = true;

            // Dosyanın shared klasörüne göre derinliğini hesapla
            const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, 'shared'));

            // Template değişikliği
            content = content.replace(pattern, (match, dots, moduleName) => {
                // path.join kullanarak düzelt
                return `require(path.join(__dirname, '${relativePath.split(path.sep).join("', '")}', '${moduleName}'))`;
            });
        }
    }

    if (modified) {
        // path require'ı ekle (yoksa)
        if (!content.includes("const path = require('path')") && !content.includes('const path = require("path")')) {
            content = "const path = require('path');\n" + content;
        }

        fs.writeFileSync(filePath, content);
        console.log('Fixed:', filePath);
        return true;
    }
    return false;
}

// Ana işlem
const baseDir = __dirname;
const jsFiles = findJsFiles(baseDir);
let fixedCount = 0;

for (const file of jsFiles) {
    if (fixFile(file)) {
        fixedCount++;
    }
}

console.log(`\nTotal files fixed: ${fixedCount}`);
