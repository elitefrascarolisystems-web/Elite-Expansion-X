import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("builds a callable Worker with the persistent database binding", async () => {
  const worker = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../dist/.openai/hosting.json", import.meta.url), "utf8"));

  assert.match(worker, /async fetch\(request, env, ctx\)/);
  assert.match(worker, /export \{ worker_entry_default as default \}/);
  assert.match(worker, /X-Frame-Options/);
  assert.match(worker, /Permissions-Policy/);
  assert.match(worker, /strict-origin-when-cross-origin/);
  assert.equal(manifest.d1, "DB");
  assert.equal(manifest.r2, null);
});

test("ships the territorial map and official expansion identity", async () => {
  const clientFiles = await readFile(new URL("../app/expansion-dashboard.tsx", import.meta.url), "utf8");
  const mapSource = await readFile(new URL("../app/territorial-map.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");

  assert.match(clientFiles, /Mapa territorial/);
  assert.match(clientFiles, /elite-expansao-logo\.png/);
  assert.match(mapSource, /Pessoas aparecem por cidade ou região aproximada/);
  assert.match(mapSource, /Não informe residência/);
  assert.match(layout, /elite-expansao-icon\.png/);
});
