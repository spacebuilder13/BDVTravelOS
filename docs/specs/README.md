# Diagram specs

`architecture.json` and `deployment.json` are the Archify specs behind `../architecture.html` and `../deployment.html`. Change the spec, then regenerate the page. Do not hand-edit those two HTML files.

The other pages in `docs/` were made with the same tool, but their specs are not in the repo.

Regenerate with Archify v2.16.0 (https://github.com/tt-a1i/archify, tag `v2.16.0`). It keeps the guided views and Present mode these pages have. Archify 3.x removed them.

```bash
# from docs/, with ARCHIFY_CHROME pointing at a Chrome/Chromium binary
A=/path/to/archify/archify/bin/archify.mjs
for t in architecture deployment; do
  node $A validate architecture specs/$t.json --quality showcase --json
  node $A deliver  architecture specs/$t.json $t.html --quality showcase --json
  node $A check    $t.html
done
```

`meta.output` in each spec is the file name, so run from `docs/`. Commit the specs and the regenerated HTML together. `frontend/scripts/copy-docs.js` copies only `docs/*.html`, so these specs are not served.
