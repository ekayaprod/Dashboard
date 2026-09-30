const fs = require('fs');
const path = require('path');

function checkFile(filepath) {
    if (filepath.endsWith('.test.js')) return;

    const lines = fs.readFileSync(filepath, 'utf8').split('\n');
    lines.forEach((line, i) => {
        // Find empty try/catch, if/else, functions
        if (line.match(/catch\s*\([^)]*\)\s*\{\s*\}/)) {
             console.log(`Empty catch: ${filepath}:${i+1}: ${line}`);
        }
        if (line.match(/try\s*\{\s*\}/)) {
             console.log(`Empty try: ${filepath}:${i+1}: ${line}`);
        }
        if (line.match(/if\s*\([^)]*\)\s*\{\s*\}/)) {
             console.log(`Empty if: ${filepath}:${i+1}: ${line}`);
        }
        if (line.match(/else\s*\{\s*\}/)) {
             console.log(`Empty else: ${filepath}:${i+1}: ${line}`);
        }
        if (line.match(/function(\s+[a-zA-Z0-9_]+)?\s*\([^)]*\)\s*\{\s*\}/)) {
             console.log(`Empty function: ${filepath}:${i+1}: ${line}`);
        }
        if (line.match(/\)\s*=>\s*\{\s*\}/)) {
             console.log(`Empty arrow function: ${filepath}:${i+1}: ${line}`);
        }
    });
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if ((fullPath.endsWith('.js') || fullPath.endsWith('.css')) && !fullPath.includes('node_modules')) {
            checkFile(fullPath);
        }
    }
}

walk('js');
if (fs.existsSync('style.css')) checkFile('style.css');
