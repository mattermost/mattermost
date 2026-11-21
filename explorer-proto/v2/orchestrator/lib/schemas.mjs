// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Validation for every artifact the orchestrator reads or writes. The v2 contract schemas (target, charter, finding,
// verdict, lesson, ...) are loaded from explorer-proto/v2/schemas; the orchestrator's own artifacts and the agent result
// formats live in ./schemas and are registered in the same Ajv instance so they can $ref the contract schemas.
// Reference forms: "charter" (a v2 schema), "orch#stage-record" and "agent#select" (definitions of the local files).
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

import {ORCH_DIR} from './common.mjs';

import {describeErrors, readSchema, SCHEMA_DIR, schemaNames} from '../../schemas/validator.mjs';

const LOCAL_SCHEMA_DIR = path.join(ORCH_DIR, 'schemas');
const AJV_DIR = path.resolve(SCHEMA_DIR, '../../../e2e-tests/playwright/node_modules/ajv');
const LOCAL_FILES = {orch: 'orchestrator', agent: 'agent-results', feature: 'feature', verifier: 'verifier-result'};

let instance;

function load() {
    if (instance) {
        return instance;
    }
    const require = createRequire(import.meta.url);
    const mod = require(AJV_DIR);
    const Ajv = mod.default ?? mod;
    const ajv = new Ajv({strict: true, strictTypes: false, strictRequired: false, allErrors: true});
    for (const name of schemaNames()) {
        ajv.addSchema(readSchema(name));
    }
    const localIds = {};
    for (const [key, file] of Object.entries(LOCAL_FILES)) {
        const schema = JSON.parse(fs.readFileSync(path.join(LOCAL_SCHEMA_DIR, `${file}.schema.json`), 'utf8'));
        ajv.addSchema(schema);
        localIds[key] = schema.$id;
    }
    instance = {ajv, localIds, compiled: new Map()};
    return instance;
}

function compileRef(ref) {
    const {ajv, localIds, compiled} = load();
    if (compiled.has(ref)) {
        return compiled.get(ref);
    }
    const [head, definition] = ref.split('#');
    let validate;
    if (localIds[head]) {
        validate = ajv.compile(
            definition ? {$ref: `${localIds[head]}#/definitions/${definition}`} : {$ref: localIds[head]},
        );
    } else {
        const known = schemaNames();
        if (!known.includes(head)) {
            throw new Error(`unknown schema reference "${ref}"`);
        }
        const id = readSchema(head).$id;
        validate = definition ? ajv.compile({$ref: `${id}#/definitions/${definition}`}) : ajv.getSchema(id);
    }
    compiled.set(ref, validate);
    return validate;
}

/** Validates data; the error lines hold the JSON path and the rule only, never instance data. */
export function validate(ref, data) {
    const check = compileRef(ref);
    const ok = check(data);
    return {ok, errors: ok ? [] : describeErrors(check.errors, 8)};
}

/** Validates against a schema object (used for the per-task agent result schemas). */
export function validateWithSchema(schema, data) {
    const {ajv} = load();
    const check = ajv.compile(schema);
    const ok = check(data);
    return {ok, errors: ok ? [] : describeErrors(check.errors, 8)};
}

export function localSchemaPath(file) {
    return path.join(LOCAL_SCHEMA_DIR, file);
}
