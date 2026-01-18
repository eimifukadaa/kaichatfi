
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');
    console.log('Required successfully:', Object.keys(pdfjs));
} catch (e) {
    console.error('Require failed:', e);
}
