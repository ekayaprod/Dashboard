const fs = require('fs');
const path = require('path');

const targetFiles = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.html'));

let hasError = false;
let report = [];

let baseline = {};
const baselinePath = path.join(__dirname, '..', 'baseline.json');
if (fs.existsSync(baselinePath)) {
    try {
        baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    } catch(e) {}
}

const ruleId = 'GL-001';

for (const file of targetFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes('js/bootstrap.js')) continue;

    const lines = content.split('\n');
    let hasBootstrapComment = false;
    let bootstrapLine = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('CRITICAL: Bootstrap script must be at the END of the body')) {
            hasBootstrapComment = true;
        }
        if (lines[i].includes('js/bootstrap.js')) {
            bootstrapLine = i + 1;
        }
    }

    if (!hasBootstrapComment && bootstrapLine !== -1) {
        if (baseline[ruleId] && baseline[ruleId].includes(file)) {
            continue; // Grandfathered
        }
        const errorMsg = `::error file=${file},line=${bootstrapLine}::[GL-001] HTML file is missing the critical bootstrap comment. Other HTML files (lookup.html, mailto.html) require it. Fix: Add "<!-- CRITICAL: Bootstrap script must be at the END of the body. It loads the Navbar HTML and all JS dependencies in parallel. -->" before <script src="js/bootstrap.js"></script>. Re-run: node .greenlight/rules/bootstrap-script-location.js`;
        console.error(errorMsg);
        report.push({ rule: ruleId, file, line: bootstrapLine, message: errorMsg });
        hasError = true;
    }
}

fs.writeFileSync(path.join(__dirname, '..', 'report.json'), JSON.stringify(report, null, 2));

if (hasError) {
    process.exit(1);
}
