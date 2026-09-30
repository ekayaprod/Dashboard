const fs = require('fs');

function checkFile(filepath) {
    if (!fs.existsSync(filepath)) return;

    const lines = fs.readFileSync(filepath, 'utf8').split('\n');
    lines.forEach((line, i) => {
        if (line.match(/>\s*</)) {
             // not necessarily empty, but could be empty tags
        }
    });
}

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));
htmlFiles.forEach(checkFile);
