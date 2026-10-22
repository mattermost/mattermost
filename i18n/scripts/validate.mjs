// Check translators' payloads against their worklists, without applying them.
//
//   node i18n/scripts/validate.mjs <workdir> [<locale>...]
//
// With no locale, checks every payload in <workdir>/translations/. Exits 1 if any
// has an error. apply.mjs runs the same check and applies nothing if one fails,
// so this is for iterating on one locale's answer, not a step to remember.
import fs from 'fs';
import path from 'path';

import {commitTree} from './lib/repo.mjs';
import {validatePayload} from './lib/validate.mjs';
import {paths, PLAN_VERSION, readJSON} from './lib/workdir.mjs';

const [workdir, ...only] = process.argv.slice(2);
if (!workdir) {
    console.error('usage: node i18n/scripts/validate.mjs <workdir> [<locale>...]');
    process.exit(2);
}

const p = paths(workdir);
if (!fs.existsSync(p.plan)) {
    console.error(`no plan in ${workdir}: run plan.mjs first`);
    process.exit(2);
}
const plan = readJSON(p.plan);
if (plan.version !== PLAN_VERSION) {
    console.error(`${p.plan} was written by another version of plan.mjs; plan again`);
    process.exit(2);
}

const available = fs.existsSync(p.translations) ?
    fs.readdirSync(p.translations).filter((f) => f.endsWith('.json')).map((f) => path.basename(f, '.json')).sort() :
    [];
const locales = only.length ? only : available;
if (!locales.length) {
    console.error(`no payloads in ${p.translations}/`);
    process.exit(2);
}

// The glossary and style as of the base: a run's own glossary additions do not
// exempt its translations.
const guidance = commitTree(plan.root, plan.base);
let failed = 0;
for (const locale of locales) {
    if (!Object.values(plan.surfaces).some(({locales: l}) => l[locale])) {
        console.error(`${locale}: no such locale in the plan`);
        failed++;
        continue;
    }
    let payload;
    try {
        payload = readJSON(p.translation(locale));
    } catch (e) {
        console.error(`${locale}: cannot read ${p.translation(locale)}: ${e.message}`);
        failed++;
        continue;
    }
    const {errors, acknowledged, stats} = validatePayload({plan, locale, payload, tree: guidance});
    console.log(`${locale}: ${stats.answered} answered, ${stats.kept} changed items kept as they were, ${acknowledged.length} acknowledged`);
    if (errors.length) {
        failed++;
        console.error(`  ${errors.length} error(s):`);
        errors.forEach((e) => console.error(`    ${e}`));
    }
}
process.exit(failed ? 1 : 0);
