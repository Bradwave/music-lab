import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mid': 'audio/midi'
};

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);
    const relPath = decodeURIComponent(reqUrl.pathname);

    let filePath = path.resolve(__dirname, `.${relPath}`);
    if (filePath !== __dirname && !filePath.startsWith(`${__dirname}${path.sep}`)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      // Match GitHub Pages behavior: redirect directories without a trailing slash
      // so relative paths (./styles/..., ./src/...) always resolve correctly.
      if (!relPath.endsWith('/')) {
        res.writeHead(301, { Location: `${reqUrl.pathname}/${reqUrl.search}` });
        res.end();
        return;
      }
      filePath = path.join(filePath, 'index.html');
    }

    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(500);
      res.end('Server error');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  MUSIC LAB running at http://${HOST}:${PORT}`);
  console.log(`    • Rack:   http://${HOST}:${PORT}/`);
  console.log(`    • SOL-16: http://${HOST}:${PORT}/gear/sol-16/`);
  console.log(`    • 3AM:    http://${HOST}:${PORT}/gear/3am/`);
  console.log(`    • DUST:   http://${HOST}:${PORT}/gear/dust/`);
  console.log(`    • PRISM:  http://${HOST}:${PORT}/gear/prism/\n`);
});
