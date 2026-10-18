import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url), catalog = require('../src/models.cjs'), ai = require('../src/ai.js');
const pkg = JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(catalog.release,pkg.version,'Every release must recheck official model catalogs and stamp the reviewed release. See docs/PUBLISH.md.');
assert.match(catalog.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
assert(Number.isFinite(Date.parse(catalog.verifiedAt)),'Invalid review date');
assert(Date.parse(catalog.verifiedAt) <= Date.now() + 86400000,'Review date cannot be in the future');
for (const provider of Object.keys(ai.presets)) {
    const entry = catalog.providers[provider]; assert(entry,`Missing provider ${provider}`);
    if (['custom','codex'].includes(provider)) continue;
    assert(entry.models.length && entry.sources.length,`Missing models/sources: ${provider}`);
    assert.equal(new Set(entry.models.map(x=>x.id)).size,entry.models.length,`Duplicate model IDs: ${provider}`);
    for (const url of entry.sources) assert.equal(new URL(url).protocol,'https:');
    for (const model of entry.models) {
        assert(model.id && model.id.trim() === model.id && !/\s/.test(model.id),`Invalid ID: ${provider}`);
        assert(model.profile === '' || catalog.levels[model.profile],`Unknown reasoning profile: ${model.id}`);
    }
}
// Optional release-day check; historic builds remain reproducible in normal CI.
if (process.argv.includes('--release')) {
    const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
    assert.equal(catalog.verifiedAt,today,'Recheck all official sources on release day before packaging.');
}
console.log(`Model catalog ${catalog.release}: ${Object.keys(catalog.providers).length-2} providers, ${Object.values(catalog.providers).reduce((n,p)=>n+p.models.length,0)} conversation IDs; reviewed ${catalog.verifiedAt}. Structural checks do not replace official-source review.`);
