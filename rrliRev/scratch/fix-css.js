const fs = require('fs');
let css = fs.readFileSync('rrliRev/src/app/globals.css', 'utf8');
const target = `@media (max-width: 600px) {
  .delivery-crew-grid {
    grid-template-columns: 1fr;
  }
}
  border-color: var(--color-accent-highlight);
  background: var(--color-accent-soft);
}`.replace(/\r?\n/g, '\r\n');

const replace = `@media (max-width: 600px) {
  .delivery-crew-grid {
    grid-template-columns: 1fr;
  }
}`.replace(/\r?\n/g, '\r\n');

if (!css.includes(target)) {
  console.error('Target not found!');
  process.exit(1);
}
css = css.replace(target, replace);
fs.writeFileSync('rrliRev/src/app/globals.css', css, 'utf8');
console.log('Fixed orphaned CSS lines!');
