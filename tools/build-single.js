// Bundles index.html + css + js into one self-contained HTML file.
// Usage: node tools/build-single.js out.html [--fragment]
//   --fragment  leave out <!doctype>/<html>/<head>/<body> (for hosts that add their own)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'pip-single.html');
const fragment = process.argv.includes('--fragment');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(root, f), 'utf8')}</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`);
if (fragment) {
  const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, '');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  html = head.trim() + '\n' + body.trim() + '\n';
}
fs.writeFileSync(out, html);
console.log('wrote', out, Math.round(html.length / 1024) + 'KB');
