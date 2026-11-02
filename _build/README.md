# Byg appen

Siderne i repoet er krypteret. Den ukrypterede kilde ligger kun lokalt i `src/` (står i `.gitignore` og må ikke committes).

Projektets kildekode i claude.ai (`claude/kildekode/`) bygges med dens `build/build.js`. Filer, der mangler dér (fx `app/tools/mg.html`, som er for stor til projektets dokumentværktøj), hentes med:

```bash
GH_APP_PW='…' node _build/dekrypter.mjs --kildekode ../kildekode   # hele app/ i kildekode-form + build/salt.txt + build/drive.json
```

Alternativt kan der arbejdes direkte i repoet:

```bash
GH_APP_PW='…' node _build/dekrypter.mjs      # henter kilden frem i src/
# ret i src/index.html eller src/tools/*.html
node _build/byg.mjs --plain /tmp/plain        # ukrypteret testudgave til lokal test
GH_APP_PW='…' node _build/byg.mjs            # krypterer siderne i repoets rod, opdaterer sw.js og version.json
```

- Det fælles lager (`window.GH`: IndexedDB, Drev, opdatering) står i `src/index.html` og kopieres ind i alle værktøjer ved bygning.
  Et nyt værktøj skal indeholde `<script>/*@@STORE@@*/</script>` og tilføjes i `PAGES` i `byg.mjs` og i `TOOLS` i lageret.
- Saltet er fast (læses fra den nuværende `index.html`), så telefoner, der husker koden, ikke skal logge ind igen.
- `sw.js` får automatisk ny `VERSION` og en `FILES`-liste med alle sider og alt i `lib/`.
