const fs = require('fs');

function checkFile(filepath) {
    if (!fs.existsSync(filepath)) return;

    const lines = fs.readFileSync(filepath, 'utf8').split('\n');
    lines.forEach((line, i) => {
        if (line.match(/\{\s*\}/)) {
             console.log(`Empty CSS block: ${filepath}:${i+1}: ${line}`);
        }
    });
}

checkFile('style.css');
