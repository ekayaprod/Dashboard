// Mock DOM
global.window = {
    addEventListener: () => {},
    crypto: { randomUUID: () => '123' }
};
global.document = {
    createElement: () => ({ style: {} }),
    getElementById: () => null,
    body: { classList: { add: () => {}, remove: () => {} }, prepend: () => {} },
    addEventListener: () => {}
};
global.navigator = { clipboard: {} };

// Load app-core
const fs = require('fs');
const coreCode = fs.readFileSync('js/app-core.js', 'utf8');
eval(coreCode);

if (typeof window.SafeUI.debounce === 'function') {
    console.log('SafeUI.debounce is a function');
} else {
    console.error('SafeUI.debounce is MISSING or not a function');
    if (window.SafeUI) {
        console.log('SafeUI keys:', Object.keys(window.SafeUI));
    } else {
        console.log('SafeUI is undefined');
    }
}
