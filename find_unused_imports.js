const fs = require('fs');
const path = require('path');

function checkFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    const importRegex = /import\s+(?:(?:\{([^}]+)\})|([a-zA-Z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
        let imports = [];
        if (match[1]) {
            imports = match[1].split(',').map(s => s.trim());
        } else if (match[2]) {
            imports = [match[2].trim()];
        }

        for (const imp of imports) {
            const aliasMatch = imp.match(/(.*)\s+as\s+(.*)/);
            const token = aliasMatch ? aliasMatch[2].trim() : imp;

            // Check usage
            const tokenRegex = new RegExp(`\\b${token}\\b`, 'g');
            const matches = content.match(tokenRegex);

            if (!matches || matches.length === 1) {
                console.log(`Unused import: ${token} in ${filepath}`);
            }
        }
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.js') && !fullPath.includes('node_modules')) {
            checkFile(fullPath);
        }
    }
}

walk('js');
