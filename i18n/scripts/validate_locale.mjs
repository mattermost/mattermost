// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Check translators' payloads against their worklists, without applying them.
//
//   node i18n/scripts/validate_locale.mjs <workdir> [<locale> | <payload.json>]...
//
// A locale checks every payload in <workdir>/translations/<locale>/ together; a
// file checks that payload alone, for a translator working on one slice. With
// neither, checks every locale. Exits 1 if any has an error. Items left
// unanswered are not an error here; finalize.mjs requires them.
//
// Checking a locale also writes <workdir>/remaining/<locale>/: its worklist,
// with only the items no payload answers, in slices for the next translators,
// each naming the answer file its translator writes. It is removed once every
// item has an answer.
// finalize.mjs runs the same check and applies nothing if one fails, so this is
// for iterating on an answer, not a step to remember.
import fs from 'fs';
import path from 'path';

import {commitTree} from './lib/repo.mjs';
import {writeRemaining} from './lib/slices.mjs';
import {mergePayloads, unanswered, validatePayload} from './lib/validate.mjs';
import {answerFiles, paths, PLAN_VERSION, readJSON} from './lib/workdir.mjs';

const [workdir, ...only] = process.argv.slice(2);
if (!workdir) {
    console.error('usage: node i18n/scripts/validate_locale.mjs <workdir> [<locale> | <payload.json>]...');
    process.exit(2);
}

const p = paths(workdir);
if (!fs.existsSync(p.plan)) {
    console.error(`no plan in ${workdir}: run plan_translations.mjs first`);
    process.exit(2);
}
const plan = readJSON(p.plan);
if (plan.version !== PLAN_VERSION) {
    console.error(`${p.plan} was written by another version of plan_translations.mjs; plan again`);
    process.exit(2);
}

const available = answerFiles(p);
const targets = (only.length ? only : Object.keys(available)).map((arg) => (arg.endsWith('.json') ?
    {label: arg, locale: path.basename(path.dirname(path.resolve(arg))), files: [arg], whole: false} :
    {label: arg, locale: arg, files: available[arg] || [], whole: true}));
if (!targets.length) {
    console.error(`no payloads in ${p.translations}/`);
    process.exit(2);
}

// The glossary and style as of the base: a run's own glossary additions do not
// exempt its translations.
const guidance = commitTree(plan.root, plan.base);
let failed = 0;
for (const {label, locale, files, whole} of targets) {
    if (!Object.values(plan.surfaces).some(({locales: l}) => l[locale])) {
        console.error(`${label}: no such locale in the plan`);
        failed++;
        continue;
    }
    const parts = [];
    const errors = [];
    for (const file of files) {
        try {
            parts.push({file, payload: readJSON(file)});
        } catch (e) {
            errors.push(`cannot read ${file}: ${e.message}`);
        }
    }
    const merged = mergePayloads(parts);
    const result = validatePayload({plan, locale, payload: merged.payload, tree: guidance});
    errors.push(...merged.errors, ...result.errors);
    const left = unanswered({plan, locale, payload: merged.payload});
    if (whole) {
        writeRemaining(p, locale, new Set(left), available[locale] || []);
    }
    console.log(`${label}: ${result.stats.answered} answered, ${left.length} unanswered, ${result.stats.kept} changed items kept as they were, ${result.stats.untouched} repairs left as they were, ${result.acknowledged.length} acknowledged`);
    if (errors.length) {
        failed++;
        console.error(`  ${errors.length} error(s):`);
        errors.forEach((e) => console.error(`    ${e}`));
    }
}
process.exit(failed ? 1 : 0);
