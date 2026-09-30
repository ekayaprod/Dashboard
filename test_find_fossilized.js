const fs = require('fs');

function checkFile(filepath) {
    if (filepath.endsWith('.test.js')) return;

    const lines = fs.readFileSync(filepath, 'utf8').split('\n');
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
            const commentBody = trimmed.substring(2).trim();
            if (/^(const|let|var|function|if|for|while|return|import|export)\s/.test(commentBody)) {
                 console.log(`Fossilized (keyword): ${filepath}:${i+1}: ${line}`);
            }
        }
    });
}
checkFile('js/apps/calculator.js');
checkFile('js/apps/dashboard.js');
checkFile('js/apps/lookup.js');
checkFile('js/apps/mailto.js');
checkFile('js/apps/passwords.js');
checkFile('js/core/app-core.js');
checkFile('js/core/app-data.js');
checkFile('js/core/app-ui.js');
checkFile('js/workers/msg-reader.js');
checkFile('js/workers/msg-worker.js');
checkFile('js/shell.js');
checkFile('js/bootstrap.js');
