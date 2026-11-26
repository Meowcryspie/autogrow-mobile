import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const nojekyllPath = path.join(distDir, '.nojekyll');

if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8')
    .replaceAll('src="/_expo/', 'src="./_expo/')
    .replaceAll('href="/_expo/', 'href="./_expo/')
    .replaceAll('href="/favicon.ico"', 'href="./favicon.ico"');
  fs.writeFileSync(indexPath, html, 'utf8');
}

fs.writeFileSync(nojekyllPath, '', 'utf8');
console.log('Prepared dist/ with relative paths and .nojekyll for static hosting.');
