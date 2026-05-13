#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const styles = await fs.readFile(path.join(rootDir, 'src/styles.css'), 'utf8');
const appJs = await fs.readFile(path.join(rootDir, 'src/static-app.js'), 'utf8');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contentstack Swiftype Search Dashboard</title>
    <link rel="stylesheet" href="/assets/styles.css" />
  </head>
  <body>
    <main id="app" class="app-shell">
      <div class="empty-state"><h1>Loading search analytics</h1></div>
    </main>
    <script src="/assets/app.js"></script>
  </body>
</html>
`;

await fs.rm(distDir, { recursive: true, force: true });
await fs.mkdir(path.join(distDir, 'assets'), { recursive: true });
await fs.mkdir(path.join(distDir, 'data'), { recursive: true });
await fs.writeFile(path.join(distDir, 'index.html'), html);
await fs.writeFile(path.join(distDir, 'assets/styles.css'), styles);
await fs.writeFile(path.join(distDir, 'assets/app.js'), appJs);
await fs.cp(path.join(rootDir, 'public/data'), path.join(distDir, 'data'), { recursive: true });

console.log('Static dashboard written to dist');
