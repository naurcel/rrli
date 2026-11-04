const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/app/globals.css');
let content = fs.readFileSync(cssPath, 'utf8');

const oldDropoffBlock = `.dropoff-row {
  position: relative;
  counter-increment: delivery-stop;
  display: grid;
  grid-template-columns: minmax(170px, 1.15fr) minmax(170px, 1.15fr) minmax(220px, 1fr) auto;
  align-items: start;
  gap: 14px;
  min-width: 0;
  padding: 18px 20px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, .36);
}

.dropoff-row label {
  display: grid;
  gap: 8px;
  min-width: 0;
  color: color-mix(in srgb, var(--color-text-primary) 82%, var(--color-text-secondary));
  font-size: 12px;
  font-weight: 750;
  line-height: 1.2;
}

.dropoff-row .expense-resolution-field {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  max-width: 100%;
}

.dropoff-row .expense-resolution-controls {
  margin-top: 0;
  gap: 8px;
}

.dropoff-row .expense-resolution-controls input {
  min-height: 44px;
}

.dropoff-row::before {
  content: counter(delivery-stop);
  position: absolute;
  z-index: 1;
  top: 20px;
  left: -35px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(180, 83, 9, .2);
}

.dropoff-row legend {
  padding: 0 6px;
  color: var(--color-accent-deep);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .05em;
}

.dropoff-remove {
  align-self: start;
  margin-top: 22px;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: #b45309;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: color .15s ease;
}

.dropoff-remove:hover {
  color: #dc2626;
}

.add-dropoff {
  justify-self: start;
}

.dropoff-limit {
  align-self: center;
  color: var(--color-text-muted);
  font-size: 11px;
}`;

const newDropoffBlock = `.dropoff-row {
  position: relative;
  counter-increment: delivery-stop;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px 20px 18px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, .42);
}

.dropoff-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 24px;
}

.dropoff-row-title {
  color: var(--color-accent-deep);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.dropoff-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.15fr) minmax(0, 1.25fr);
  gap: 14px;
  align-items: start;
  width: 100%;
}

.dropoff-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.field-label-text,
.dropoff-field .field-label-text {
  display: block;
  color: color-mix(in srgb, var(--color-text-primary) 82%, var(--color-text-secondary));
  font-size: 12px;
  font-weight: 750;
  line-height: 1.2;
}

.dropoff-field input {
  width: 100%;
  min-height: 44px;
  height: 44px;
  border: 1px solid var(--border, rgba(116, 130, 126, 0.18));
  border-radius: 14px;
  background: var(--surface, rgba(255, 255, 255, 0.72));
  color: inherit;
  padding: 0 14px;
}

.dropoff-entry-fee-wrap .expense-resolution-field {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  max-width: 100%;
}

.dropoff-entry-fee-wrap .expense-resolution-controls {
  margin-top: 0;
  gap: 8px;
}

.dropoff-entry-fee-wrap .expense-resolution-controls input {
  min-height: 44px;
  height: 44px;
}

.dropoff-row::before {
  content: counter(delivery-stop);
  position: absolute;
  z-index: 1;
  top: 18px;
  left: -35px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(180, 83, 9, .2);
}

.dropoff-remove {
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #b45309;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: color .15s ease, background-color .15s ease;
}

.dropoff-remove:hover {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
}

.add-dropoff {
  justify-self: start;
}

.dropoff-actions-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 4px;
}

.dropoff-counter {
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 600;
}

.peso-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.peso-prefix {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-accent-deep, #b45309);
  font-size: 13px;
  font-weight: 750;
  pointer-events: none;
  user-select: none;
  z-index: 2;
  line-height: 1;
}

.peso-input-wrap input.peso-input {
  padding-left: 30px !important;
}

.peso-input-wrap.is-disabled .peso-prefix {
  display: none;
}`;

const oldMediaBlock = `@media (max-width: 1080px) and (min-width: 821px) {
  .delivery-trip-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .delivery-finance-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
  .dropoff-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dropoff-row .expense-resolution-field { grid-column: 1 / -1; }
  .dropoff-remove { justify-self: start; }
}`;

const newMediaBlock = `@media (max-width: 1080px) and (min-width: 821px) {
  .delivery-trip-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .delivery-finance-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
}

@media (max-width: 860px) {
  .dropoff-fields {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}`;

const normalized = content.replace(/\r\n/g, '\n');
if (!normalized.includes(oldDropoffBlock)) {
  console.error('Could not find oldDropoffBlock');
  process.exit(1);
}
if (!normalized.includes(oldMediaBlock)) {
  console.error('Could not find oldMediaBlock');
  process.exit(1);
}

let updated = normalized.replace(oldDropoffBlock, newDropoffBlock);
updated = updated.replace(oldMediaBlock, newMediaBlock);
fs.writeFileSync(cssPath, updated.replace(/\n/g, '\r\n'), 'utf8');
console.log('Successfully updated globals.css!');

