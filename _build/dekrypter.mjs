/* Henter den ukrypterede kilde frem fra de krypterede sider i repoet.
   Brug:  GH_APP_PW='…' node _build/dekrypter.mjs                    → src/index.html, src/tools/*.html (til _build/byg.mjs)
          GH_APP_PW='…' node _build/dekrypter.mjs --kildekode <mappe> → <mappe>/app/… i samme form som projektets kildekode
                                                                          (js/store.js for sig, build/build.js-format)
   src/ og kildekode-mapper er ukrypterede og må IKKE committes. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {fileURLToPath} from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = process.env.GH_APP_PW;
if (!pw) { console.error('Sæt GH_APP_PW'); process.exit(1); }
const ki = process.argv.indexOf('--kildekode'), KK = ki > 0 ? path.resolve(process.argv[ki + 1] || 'kildekode') : null;
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
  if (KK){ kildekode(rel, pt); continue; }
  fs.mkdirSync(path.dirname(path.join(ROOT, 'src', rel)), {recursive:true});
  fs.writeFileSync(path.join(ROOT, 'src', rel), pt);
  console.log('src/' + rel + ' (' + Math.round(pt.length / 1024) + ' kB)');
}
/* Kildekode-form: det indlejrede lager tages ud til app/js/store.js (med pladsholdere), og siden får <script src="js/store.js">. */
function kildekode(rel, pt){
  const START = '/* Galten Hustjek – fælles lager', i = pt.indexOf(START), j = pt.indexOf('\n</script>', i);
  if (i < 9 || pt.slice(i - 9, i) !== '<script>\n') throw new Error(rel + ': fandt ikke det fælles lager');
  const page = pt.slice(0, i - 9) + '<script src="' + (rel.includes('/') ? '../' : '') + 'js/store.js"></script>' + pt.slice(j + '\n</script>'.length);
  const out = path.join(KK, 'app', rel);
  fs.mkdirSync(path.dirname(out), {recursive:true}); fs.writeFileSync(out, page);
  if (rel === 'index.html'){
    let st = pt.slice(i, j).replace(/\n$/, '') + '\n';
    const d = st.match(/const DRIVE_CFG = \{clientId:'([^']*)', apiKey:'([^']*)', appId:'([^']*)'\};/);
    st = st.replace(/const DRIVE_CFG = \{[^}]*\};/, "const DRIVE_CFG = {clientId:'__DRIVE_CLIENT_ID__', apiKey:'__DRIVE_API_KEY__', appId:'__DRIVE_APP_ID__'};")
           .replace(/const APP_VERSION = \{[^}]*\};/, "const APP_VERSION = {v:'__APP_VERSION__', built:'__APP_BUILT__'};");
    fs.mkdirSync(path.join(KK, 'app', 'js'), {recursive:true}); fs.writeFileSync(path.join(KK, 'app', 'js', 'store.js'), st);
    fs.mkdirSync(path.join(KK, 'build'), {recursive:true});
    if (d) fs.writeFileSync(path.join(KK, 'build', 'drive.json'), JSON.stringify({clientId:d[1], apiKey:d[2], appId:d[3]}, null, 1) + '\n');
    const E = JSON.parse(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/var ENC=(\{.*?"it":\d+\});/s)[1]);
    fs.writeFileSync(path.join(KK, 'build', 'salt.txt'), E.salt + '\n');
    console.log(path.join(KK, 'app/js/store.js') + ', build/salt.txt' + (d ? ', build/drive.json' : ''));
  }
  console.log(out + ' (' + Math.round(page.length / 1024) + ' kB)');
}
