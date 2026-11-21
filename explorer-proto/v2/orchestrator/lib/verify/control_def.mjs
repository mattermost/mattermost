// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The negative control applied to the spec: its definition file (controls/<id>.json), its cross-check against the
// session charter, and the plan handed to the frozen mutation_control gate. Titles are synthetic literals; nothing in
// this module holds an origin, an id or a credential.
import path from 'node:path';

import {declaredBookmarks, loadCharter} from './fixture.mjs';

import {ORCH_DIR, readJson, sha256File} from '../common.mjs';
import {infraPaths} from '../infra.mjs';
import {validate} from '../schemas.mjs';

const SAFE_TITLE = /^[A-Za-z0-9 ]+$/;

export function controlFile(id) {
    return path.join(ORCH_DIR, 'controls', `${id}.json`);
}

/**
 * Loads controls/<id>.json and checks it against the charter it references. Returns {def, charter, entry, file,
 * sha256, declaredTitle}. Throws a message when the definition is invalid or disagrees with the charter.
 */
export function loadControl(id, session) {
    if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(id)) {
        throw new Error('--control must look like a charter negative control id');
    }
    const file = controlFile(id);
    let def;
    try {
        def = readJson(file);
    } catch {
        throw new Error(`no control definition controls/${id}.json`);
    }
    const shape = validate('orch#control-definition', def);
    if (!shape.ok) {
        throw new Error(`controls/${id}.json is invalid: ${shape.errors.join('; ')}`);
    }
    if (def.id !== id || def.charter.negative_control_id !== id) {
        throw new Error(`controls/${id}.json names a different control id`);
    }
    if (def.charter.session !== session) {
        throw new Error(`control ${id} belongs to session ${def.charter.session}, not ${session}`);
    }
    const charter = loadCharter(session);
    const entry = (charter.negative_controls ?? []).find((c) => c.id === id);
    if (!entry) {
        throw new Error(`the ${session} charter has no negative control ${id}`);
    }
    const declared = declaredBookmarks(charter).find((b) => b.channel === def.channel);
    if (!declared) {
        throw new Error(`the ${session} charter declares no bookmark for channel ${def.channel}`);
    }
    for (const title of [declared.display_name, def.changed_title]) {
        if (!SAFE_TITLE.test(title)) {
            throw new Error('control titles may hold letters, digits and spaces only');
        }
    }
    if (def.changed_title === declared.display_name) {
        throw new Error('the changed title equals the declared title');
    }
    if (
        !String(entry.change).includes(`"${def.changed_title}"`) ||
        !String(entry.restore).includes(declared.display_name)
    ) {
        throw new Error(`controls/${id}.json disagrees with the charter's change and restore text`);
    }
    if (!entry.expected_failing_assertion) {
        throw new Error('the charter control names no expected_failing_assertion');
    }
    return {
        def,
        charter,
        entry,
        file: `explorer-proto/v2/orchestrator/controls/${id}.json`,
        sha256: sha256File(file),
        declaredTitle: declared.display_name,
    };
}

const equalsRule = (pathName, value) => ({path: pathName, equals: value});
const readExpect = (title) => [equalsRule('length', 1), equalsRule('0', title)];

/**
 * The plan for gates/mutation_control.mjs runControl(): precondition read, owner patch, read-back, then the restore
 * and its read-back. The commands are the definition's templates; only variables are filled in.
 */
export function buildPlan({control, expectation}) {
    const {def, declaredTitle} = control;
    const read = {cmd: def.commands.read};
    return {
        id: def.id,
        control: control.entry,
        vars: {
            channel: def.channel,
            title_declared: declaredTitle,
            title_changed: def.changed_title,
            bookmark_ctl: infraPaths().bookmarkCtl,
        },
        precondition: {read, expect: readExpect(declaredTitle)},
        mutator: {cmd: def.commands.mutate},
        mutation_readback: {read, expect: readExpect(def.changed_title)},
        restore: {cmd: def.commands.restore},
        restore_readback: {read, expect: readExpect(declaredTitle)},
        expectation,
    };
}
