/* Bygger den krypterede app ud fra den ukrypterede kilde i src/ (src/ ligger IKKE i git).
   Brug:   GH_APP_PW='…' node _build/byg.mjs            → krypterede sider i repoets rod (til GitHub Pages)
           node _build/byg.mjs --plain /tmp/plain        → ukrypteret testudgave (kun lokalt, må ikke lægges ud)
   Få kilden frem først med:  GH_APP_PW='…' node _build/dekrypter.mjs

   - Det fælles lager (store) står inline i src/index.html og kopieres ind i alle værktøjer.
     Et værktøj markerer stedet med <script src="../js/store.js"></script> (som i projektets kildekode) eller <script>/*@@STORE@@*\/</script>, ellers udskiftes en ældre kopi.
   - Saltet er fast (læses fra den nuværende index.html), så telefoner, der husker koden, ikke skal logge ind igen. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {fileURLToPath} from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const PAGES = [
  ['index.html', 'Galten Hustjek'],
  ['tools/dv.html', 'Galten Hustjek – Drift og vedligehold'],
  ['tools/kr.html', 'Galten Hustjek – Køberrådgivning'],
  ['tools/mg.html', 'Galten Hustjek – Mangelgennemgang'],
  ['tools/bt.html', 'Galten Hustjek – Byggetilsyn'],
];
const STATIC = ['manifest.webmanifest', 'robots.txt', '.nojekyll', 'icons', 'lib'];
const args = process.argv.slice(2);
const plain = args[0] === '--plain' ? path.resolve(args[1] || '/tmp/plain') : null;
const OUT = plain || ROOT;

const read = f => fs.readFileSync(f, 'utf8');
const STORE_START = '/* Galten Hustjek – fælles lager';
function storeOf(html){
  const i = html.indexOf(STORE_START);
  if (i < 0) throw new Error('Fandt ikke det fælles lager i src/index.html');
  const j = html.indexOf('\n</script>', i);
  return html.slice(i, j + 1);
}
const store0 = storeOf(read(path.join(SRC, 'index.html')));
const v = 'gh-' + Date.now().toString(36), built = new Date().toISOString();
const store = store0.replace(/const APP_VERSION = \{[^}]*\};/, `const APP_VERSION = {v:'${v}', built:'${built}'};`);
if (store === store0 && !/APP_VERSION = \{v:'__/.test(store0)) console.warn('Advarsel: APP_VERSION blev ikke fundet');

function page(rel){
  let html = read(path.join(SRC, rel));
  if (html.includes('/*@@STORE@@*/')) html = html.replace('/*@@STORE@@*/', () => '\n' + store);
  else if (/<script src="(\.\.\/)?js\/store\.js"><\/script>/.test(html)) html = html.replace(/<script src="(\.\.\/)?js\/store\.js"><\/script>/, () => '<script>\n' + store + '</script>');
  else if (html.includes(STORE_START)) { const old = storeOf(html); html = html.replace(old, () => store); }
  else throw new Error(rel + ': mangler det fælles lager');
  return html;
}

/* ---- kryptering ---- */
let KEY = null, SALT = null;
const ENC_RE = /var ENC=(\{.*?"it":\d+\});/s;
function setupKey(){
  const cur = read(path.join(ROOT, 'index.html'));
  const E = JSON.parse(cur.match(ENC_RE)[1]);
  const pw = process.env.GH_APP_PW;
  if (!pw) throw new Error('Sæt GH_APP_PW');
  SALT = E.salt;
  KEY = crypto.pbkdf2Sync(pw, Buffer.from(E.salt, 'base64'), E.it, 32, 'sha256');
  const ct = Buffer.from(E.ct, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(E.iv, 'base64'));
  d.setAuthTag(ct.subarray(ct.length - 16));
  try { d.update(ct.subarray(0, ct.length - 16)); d.final(); }
  catch (e) { throw new Error('Forkert adgangskode (den passer ikke til den nuværende app)'); }
}
function encrypt(text){
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final(), c.getAuthTag()]);
  return {salt: SALT, iv: iv.toString('base64'), ct: ct.toString('base64'), it: 600000};
}
/* Låseskærmen tages fra den nuværende index.html (rod) og kr.html (værktøjer). */
const WRAP_ROOT = read(path.join(ROOT, 'index.html'));
const WRAP_TOOL = read(path.join(ROOT, 'tools', 'kr.html'));
function wrap(rel, title, html){
  let w = rel.includes('/') ? WRAP_TOOL : WRAP_ROOT;
  w = w.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  return w.replace(ENC_RE, () => 'var ENC=' + JSON.stringify(encrypt(html)) + ';');
}

function copyRec(from, to){
  const st = fs.statSync(from);
  if (st.isDirectory()){ fs.mkdirSync(to, {recursive:true}); for (const f of fs.readdirSync(from)) copyRec(path.join(from, f), path.join(to, f)); }
  else fs.copyFileSync(from, to);
}
function listFiles(dir){
  const out = [];
  (function walk(d){ for (const f of fs.readdirSync(path.join(ROOT, d))){ const r = d ? d + '/' + f : f; if (fs.statSync(path.join(ROOT, r)).isDirectory()) walk(r); else out.push(r); } })(dir);
  return out;
}

if (!plain) setupKey();
fs.mkdirSync(path.join(OUT, 'tools'), {recursive:true});
for (const [rel, title] of PAGES){
  const html = page(rel);
  fs.writeFileSync(path.join(OUT, rel), plain ? html : wrap(rel, title, html));
  console.log((plain ? 'ukrypteret ' : 'krypteret ') + rel + ' (' + Math.round(html.length / 1024) + ' kB)');
}
if (plain) for (const s of STATIC) if (fs.existsSync(path.join(ROOT, s))) copyRec(path.join(ROOT, s), path.join(OUT, s));

const FILES = ['./', ...PAGES.map(p => p[0]), 'manifest.webmanifest',
  ...listFiles('lib').filter(f => !/\.txt$/.test(f)), 'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo.png'];
let sw = read(path.join(ROOT, 'sw.js'));
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${v}';`)
       .replace(/const FILES = \[[\s\S]*?\];/, 'const FILES = [\n  ' + FILES.map(f => `'${f}'`).join(', ') + '\n];');
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({v, built}));
console.log('version ' + v + ' → ' + OUT);
