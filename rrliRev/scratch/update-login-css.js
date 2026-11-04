const fs = require('fs');

let css = fs.readFileSync('rrliRev/src/app/globals.css', 'utf8');

const target1 = `.sign-in-button {
  min-height: 52px;
  margin-top: 4px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(105deg, var(--color-accent-deep), var(--color-accent-highlight));
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 7px 18px rgba(180, 83, 9, .26);
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, background-color .2s ease;
}

.sign-in-button:hover:not(:disabled) {
  background: linear-gradient(105deg, #92400e, var(--color-accent));
  box-shadow: 0 9px 22px rgba(180, 83, 9, .34);
  transform: translateY(-1px);
}

.sign-in-button:disabled {
  cursor: wait;
  opacity: .74;
}`.replace(/\r?\n/g, '\r\n');

const replace1 = `.sign-in-button {
  min-height: 48px;
  width: 100%;
  margin-top: 14px;
  border: 0;
  border-radius: 9999px;
  background: #0064e0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 4px 14px rgba(0, 100, 224, 0.22);
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease;
}

.sign-in-button:hover:not(:disabled) {
  background: #0052ba;
  box-shadow: 0 6px 18px rgba(0, 100, 224, 0.32);
  transform: translateY(-1px);
}

.sign-in-button:active:not(:disabled) {
  background: #0047a5;
  transform: scale(0.99);
}

.sign-in-button:disabled {
  cursor: wait;
  opacity: .74;
}`.replace(/\r?\n/g, '\r\n');

if (!css.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
css = css.replace(target1, replace1);

const target2 = `/* Centered Forgot Password Link below Login button */
.login-forgot-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 18px;
  text-align: center;
}

.forgot-password-link {
  display: inline-block;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: var(--color-text-primary, #0f172a);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s ease, text-decoration 0.15s ease;
}

.forgot-password-link:hover {
  text-decoration: underline;
  color: var(--color-accent-deep, #000);
}

.theme-dark .forgot-password-link,
html[data-theme="dark"] .forgot-password-link {
  color: #edf3f7;
}

.theme-dark .forgot-password-link:hover,
html[data-theme="dark"] .forgot-password-link:hover {
  color: #ffffff;
}`.replace(/\r?\n/g, '\r\n');

const replace2 = `/* Centered Forgot Password Link below Login button */
.login-forgot-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 26px;
  text-align: center;
}

.forgot-password-link {
  display: inline-block;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: #111827;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s ease, text-decoration 0.15s ease;
}

.forgot-password-link:hover {
  text-decoration: underline;
  color: #0064e0;
}

.theme-dark .forgot-password-link,
html[data-theme="dark"] .forgot-password-link {
  color: #edf3f7;
}

.theme-dark .forgot-password-link:hover,
html[data-theme="dark"] .forgot-password-link:hover {
  color: #60a5fa;
}`.replace(/\r?\n/g, '\r\n');

if (!css.includes(target2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}
css = css.replace(target2, replace2);

fs.writeFileSync('rrliRev/src/app/globals.css', css, 'utf8');
console.log('Successfully updated globals.css with new button and forgot password styling!');
