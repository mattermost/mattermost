// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Loads the v2 schemas into Ajv from the Playwright workspace (already installed; nothing is fetched or installed).
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SCHEMA_DIR = path.dirname(fileURLToPath(import.meta.url));
const AJV_DIR = path.resolve(SCHEMA_DIR, '../../../e2e-tests/playwright/node_modules/ajv');
const SCHEMA_FILE = /^(.+)\.schema\.json$/;

function loadAjvClass() {
    const require = createRequire(import.meta.url);
    let mod;
    try {
        mod = require(AJV_DIR);
    } catch {
        throw new Error(
            'ajv is not available under e2e-tests/playwright/node_modules (run the Playwright workspace install)',
        );
    }
    const Ajv = mod.default ?? mod;
    const version = require(path.join(AJV_DIR, 'package.json')).version;
    if (!version.startsWith('8.')) {
        throw new Error(`ajv 8.x is required, found ${version}`);
    }
    return Ajv;
}

export function schemaNames() {
    return fs
        .readdirSync(SCHEMA_DIR)
        .map((f) => SCHEMA_FILE.exec(f)?.[1])
        .filter(Boolean)
        .sort();
}

export function readSchema(name) {
    return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, `${name}.schema.json`), 'utf8'));
}

export function createValidators() {
    const Ajv = loadAjvClass();
    const ajv = new Ajv({strict: true, strictTypes: false, strictRequired: false, allErrors: true});
    const names = schemaNames();
    for (const name of names) {
        ajv.addSchema(readSchema(name));
    }
    const byName = new Map();
    for (const name of names) {
        byName.set(name, ajv.getSchema(readSchema(name).$id));
    }
    return {
        names,
        get(name) {
            const validate = byName.get(name);
            if (!validate) {
                throw new Error(`unknown schema "${name}"; known: ${names.join(', ')}`);
            }
            return validate;
        },
    };
}

// Error lines never include instance data, only the JSON path and the rule message.
export function describeErrors(errors, limit = 5) {
    return (errors ?? []).slice(0, limit).map((e) => {
        const extra = e.keyword === 'additionalProperties' ? ` (${e.params.additionalProperty})` : '';
        return `${e.instancePath || '/'}: ${e.message}${extra}`;
    });
}
