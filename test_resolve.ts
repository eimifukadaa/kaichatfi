
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
    const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    console.log('Resolved worker path:', workerPath);
} catch (e) {
    console.error('Failed to resolve worker:', e);
}
