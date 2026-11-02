/* Henter den ukrypterede kilde frem fra de krypterede sider i repoet.
   Brug:  GH_APP_PW='…' node _build/dekrypter.mjs      → src/index.html, src/tools/*.html
   src/ er ukrypteret og må IKKE committes (står i .gitignore). Ret i src/, og byg med _build/byg.mjs. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {fileURLToPath} from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = process.env.GH_APP_PW;
if (!pw) { console.error('Sæt GH_APP_PW'); process.exit(1); }
const pages = ['index.html', ...fs.readdirSync(path.join(ROOT, 'tools')).filter(f => f.endsWith('.html')).map(f => 'tools/' + f)];
for (const rel of pages){
  const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const m = s.match(/var ENC=(\{.*?"it":\d+\});/s);
  if (!m) { console.log('springer over ' + rel); continue; }
  const E = JSON.parse(m[1]);
  const key = crypto.pbkdf2Sync(pw, Buffer.from(E.salt, 'base64'), E.it, 32, 'sha256');
  const ct = Buffer.from(E.ct, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(E.iv, 'base64'));
  d.setAuthTag(ct.subarray(ct.length - 16));
  let pt;
  try { pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString('utf8'); }
  catch (e) { console.error('Forkert adgangskode'); process.exit(1); }
  fs.mkdirSync(path.dirname(path.join(ROOT, 'src', rel)), {recursive:true});
  fs.writeFileSync(path.join(ROOT, 'src', rel), pt);
  console.log('src/' + rel + ' (' + Math.round(pt.length / 1024) + ' kB)');
}
