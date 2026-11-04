const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/app/globals.css');
let content = fs.readFileSync(cssPath, 'utf8');

const target = `/* Completed delivery entry */
.delivery-entry-page {
  width: min(100%, 980px);
  max-width: 980px;
  margin-inline: auto !important;
  padding-inline: clamp(20px, 3.5vw, 42px);
}

.delivery-entry-page .page-intro {
  margin-bottom: 26px;
}

.back-link {
  display: inline-flex;
  margin-bottom: 22px;
  color: var(--color-accent-deep);
  font-size: 12px;
  font-weight: 700;
}

.delivery-entry-form {
  display: grid;
  gap: 18px;
  padding-bottom: 48px;
}

.delivery-form-section {
  padding: 26px;`;

const replacement = `/* Completed delivery entry */
.delivery-entry-page {
  width: min(100%, 820px);
  max-width: 820px;
  margin-inline: auto !important;
  padding-inline: clamp(16px, 2.5vw, 28px);
}

.delivery-entry-page .page-intro {
  margin-bottom: 24px;
}

.back-link {
  display: inline-flex;
  margin-bottom: 20px;
  color: var(--color-accent-deep);
  font-size: 12px;
  font-weight: 700;
}

.delivery-entry-form {
  display: grid;
  gap: 16px;
  padding-bottom: 48px;
}

.delivery-form-section {
  padding: 24px;`;

const normalized = content.replace(/\r\n/g, '\n');
if (!normalized.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}
const updated = normalized.replace(target, replacement);
fs.writeFileSync(cssPath, updated.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully updated delivery-entry-page width to 820px!');

