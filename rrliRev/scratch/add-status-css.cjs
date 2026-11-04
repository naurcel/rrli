const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/app/globals.css');
let content = fs.readFileSync(cssPath, 'utf8');

const target = `.record-detail-footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}`;

const replacement = `.record-detail-footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.financial-action-status {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-accent-deep);
  margin-right: auto;
}`;

const normalized = content.replace(/\r\n/g, '\n');
if (!normalized.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}
const updated = normalized.replace(target, replacement);
fs.writeFileSync(cssPath, updated.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully added financial-action-status CSS!');

