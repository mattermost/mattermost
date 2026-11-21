#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Usage: node validate.mjs <schema-name|schema-file> <json-file>
// Prints "OK <file>" or "FAIL <file>" followed by the first errors (path and rule only, never data).
// Exit 0 valid, 1 invalid, 2 usage or load error.
import fs from 'node:fs';
import path from 'node:path';

import {createValidators, describeErrors, SCHEMA_DIR} from './validator.mjs';

function schemaNameFrom(arg) {
    const base = path.basename(arg).replace(/\.schema\.json$/, '');
    const inSchemaDir = fs.existsSync(path.join(SCHEMA_DIR, `${base}.schema.json`));
    return inSchemaDir ? base : arg;
}

function main(argv) {
    if (argv.length !== 2) {
        process.stderr.write('usage: validate.mjs <schema> <file>\n');
        return 2;
    }
    const [schemaArg, file] = argv;
    let data;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        process.stdout.write(`FAIL ${file}\n  /: unreadable or not JSON\n`);
        return 1;
    }
    let validate;
    try {
        validate = createValidators().get(schemaNameFrom(schemaArg));
    } catch (e) {
        process.stderr.write(`${e.message}\n`);
        return 2;
    }
    if (validate(data)) {
        process.stdout.write(`OK ${file}\n`);
        return 0;
    }
    process.stdout.write(
        `FAIL ${file}\n${describeErrors(validate.errors)
            .map((l) => `  ${l}\n`)
            .join('')}`,
    );
    return 1;
}

process.exitCode = main(process.argv.slice(2));
