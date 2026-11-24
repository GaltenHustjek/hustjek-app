/* Galten Hustjek – postkasse til sælgeroplysninger (Google Apps Script, kører i Galten Hustjeks egen Google-konto).
   Sælger sender sine svar fra saelger.html (POST). Appen henter dem med nøglen (GET ?k=<sagsnøgle>&s=<nøgle>).
   Svarene gemmes i Drev-mappen "Hustjek – sælgersvar": <sagsnøgle>.json til appen og en læsbar .txt som dokumentation.
   Udrulning: Implementér → Ny implementering → Webapp, "Udfør som: Mig", "Hvem har adgang: Alle".
   NOEGLE sættes ved udrulningen og står også i appen (tr.html, SLR_DEF). Den må ikke lægges i repoet. */
var NOEGLE = '@@NOEGLE@@';
var MAPPE = 'Hustjek – sælgersvar';
var KEY_RE = /^[A-Za-z0-9]{12,40}$/;

function mappe_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('MAPPE');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  var ny = DriveApp.createFolder(MAPPE); p.setProperty('MAPPE', ny.getId()); return ny;
}
function ud_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    if (!raw || raw.length > 300000) return ud_({ok: false, err: 'størrelse'});
    var d = JSON.parse(raw);
    if (!KEY_RE.test(d.k || '')) return ud_({ok: false, err: 'nøgle'});
    d.modtaget = new Date().toISOString();
    var adr = String(d.adr || 'ukendt adresse').replace(/[\\\/:*?"<>|]/g, ' ').slice(0, 80);
    var m = mappe_();
    m.createFile(d.k + '.json', JSON.stringify(d), 'application/json');
    if (d.tekst) m.createFile(adr + ' – sælgeroplysninger ' + Utilities.formatDate(new Date(), 'Europe/Copenhagen', 'yyyy-MM-dd HH.mm') + '.txt', String(d.tekst), 'text/plain');
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Sælgeroplysninger modtaget – ' + adr,
        'Sælger har udfyldt sælgeroplysningerne for ' + adr + '.\n\nSvarene hentes automatisk ind i sagen i appen (fanen Sælger), næste gang den er online.');
    } catch (x) {}
    return ud_({ok: true, modtaget: d.modtaget});
  } catch (err) {
    return ud_({ok: false, err: String(err && err.message || err)});
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.s !== NOEGLE) return ud_({ok: false, err: 'auth'});
  var keys = String(p.k || '').split(',').filter(function (k) { return KEY_RE.test(k); }).slice(0, 50), svar = {}, m = mappe_();
  keys.forEach(function (k) {
    var it = m.getFilesByName(k + '.json'), best = null;
    while (it.hasNext()) { var f = it.next(); if (!best || f.getDateCreated() > best.getDateCreated()) best = f; }
    if (best) svar[k] = JSON.parse(best.getBlob().getDataAsString());
  });
  return ud_({ok: true, svar: svar});
}

/* Kør én gang fra editoren for at give adgang (Drev og mail) og oprette mappen. */
function opsaetning() { Logger.log('Mappe: ' + mappe_().getUrl()); }
