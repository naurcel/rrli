const fs = require('fs');

let css = fs.readFileSync('rrliRev/src/app/globals.css', 'utf8');

const target = `.crew-expense-groups {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(100%, 560px);
  max-width: 560px;
}

.crew-expense-group {
  padding: 14px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--glass-surface-strong) 65%, transparent);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.crew-expense-group h4 {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.35px;
  text-transform: uppercase;
  color: var(--color-accent-deep);
}

.crew-expense-fields-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 680px) {
  .crew-expense-fields-row {
    grid-template-columns: 1fr;
  }
}`;

const replacement = `/* Record Delivery Form: Delivery Rate vs Fuel Rate Clarification */
.delivery-rate-banner {
  grid-column: 1 / -1;
  padding: 16px 18px;
  border: 1px solid rgba(0, 100, 224, 0.2);
  border-radius: 14px;
  background: color-mix(in srgb, rgba(0, 100, 224, 0.04) 50%, var(--glass-surface-strong));
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 620px;
}

.delivery-rate-banner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.delivery-rate-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(0, 100, 224, 0.1);
  color: #0064e0;
  border: 1px solid rgba(0, 100, 224, 0.22);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.delivery-rate-clarification {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.delivery-rate-clarification strong {
  color: var(--color-text-primary);
}

.delivery-rate-input-row {
  margin-top: 4px;
}

.field-explanatory-note {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.fuel-rate-field-wrap {
  display: flex;
  flex-direction: column;
}

/* Record Delivery Form: Up to 2 Helpers Support & Personnel Rates */
.crew-expense-groups {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(100%, 640px);
  max-width: 640px;
}

.crew-expense-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 2px;
}

.crew-section-subtitle {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.crew-section-caption {
  margin: 3px 0 0;
  font-size: 11px;
  color: var(--color-text-muted);
}

.add-second-helper-btn {
  font-size: 11px;
  padding: 6px 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.crew-max-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid rgba(16, 185, 129, 0.28);
  white-space: nowrap;
}

.crew-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.crew-expense-group {
  padding: 14px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--glass-surface-strong) 65%, transparent);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
}

.crew-card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.crew-role-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.crew-role-pill.driver {
  background: rgba(14, 165, 233, 0.14);
  color: #0284c7;
  border: 1px solid rgba(14, 165, 233, 0.25);
}

.crew-role-pill.helper {
  background: rgba(245, 158, 11, 0.14);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.crew-role-pill.helper-2 {
  background: rgba(139, 92, 246, 0.14);
  color: #7c3aed;
  border: 1px solid rgba(139, 92, 246, 0.25);
}

.crew-name-input {
  flex: 1;
  padding: 4px 10px !important;
  font-size: 12px !important;
  height: 30px !important;
  min-height: 30px !important;
  border-radius: 6px !important;
  border: 1px solid var(--line) !important;
  background: var(--color-surface) !important;
}

.remove-helper-btn {
  margin-left: auto;
  padding: 3px 8px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.remove-helper-btn:hover {
  background: rgba(239, 68, 68, 0.18);
}

.helper-2-card {
  border-color: rgba(139, 92, 246, 0.28);
  background: color-mix(in srgb, rgba(139, 92, 246, 0.04) 50%, var(--glass-surface-strong));
}

.crew-expense-fields-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 680px) {
  .crew-expense-fields-row {
    grid-template-columns: 1fr;
  }
}`;

const targetNorm = target.replace(/\r?\n/g, '\n');
const cssNorm = css.replace(/\r?\n/g, '\n');

if (!cssNorm.includes(targetNorm)) {
  console.error('Target CSS not found!');
  process.exit(1);
}

// Preserve original line endings
const isCRLF = css.includes('\r\n');
const replNorm = isCRLF ? replacement.replace(/\r?\n/g, '\r\n') : replacement.replace(/\r?\n/g, '\n');
const targetToReplace = isCRLF ? target.replace(/\r?\n/g, '\r\n') : target.replace(/\r?\n/g, '\n');

css = css.replace(targetToReplace, replNorm);
fs.writeFileSync('rrliRev/src/app/globals.css', css, 'utf8');
console.log('Successfully updated globals.css with new form styles!');
