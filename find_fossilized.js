const fs = require('fs');
const path = require('path');

function checkFile(filepath) {
    if (filepath.endsWith('.test.js')) return;

    const lines = fs.readFileSync(filepath, 'utf8').split('\n');
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') && !trimmed.startsWith('///')) {
            const commentBody = trimmed.substring(2).trim();
            if (commentBody.includes('=') || commentBody.includes('(') || commentBody.includes('{') || commentBody.includes('TODO')) {
                // Ignore structural comments like // =================
                if (/^={2,}/.test(commentBody)) return;
                // Ignore simple text that might have parens, but look for code-like patterns
                if (/^(const|let|var|function|if|for|while|return|import|export)\s/.test(commentBody)) {
                     console.log(`Fossilized (keyword): ${filepath}:${i+1}: ${line}`);
                }

                // Also look for // x = 5; or // foo();
                if (/^[a-zA-Z0-9_]+\s*=/.test(commentBody) || /^[a-zA-Z0-9_]+\(/.test(commentBody)) {
                     console.log(`Fossilized (assignment/call): ${filepath}:${i+1}: ${line}`);
                }
            }
            if (commentBody.startsWith('TODO')) {
                console.log(`Fossilized (TODO): ${filepath}:${i+1}: ${line}`);
            }
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
