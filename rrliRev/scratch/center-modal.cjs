const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/app/globals.css');
let content = fs.readFileSync(cssPath, 'utf8');

const oldLine798 = `.record-detail-layer { position: fixed; z-index: 80; inset: 0; display: flex; justify-content: flex-end; }`;
const newLine798 = `.record-detail-layer { position: fixed; z-index: 80; inset: 0; display: flex; justify-content: center; align-items: center; }`;

content = content.replace(oldLine798, newLine798);
fs.writeFileSync(cssPath, content, 'utf8');
console.log('Cleaned up line 798 in globals.css!');
