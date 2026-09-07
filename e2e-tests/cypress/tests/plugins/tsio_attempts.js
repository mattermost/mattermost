// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Mochawesome 7 does not include retry attempts. Preserve Cypress's actual
// after:spec results for the TSIO dispatcher to join to the reporter output.
// The dispatcher supplies a fresh directory for each invocation and refuses
// incomplete joins; ordinary local Cypress runs do not create these files.
module.exports = (spec, results) => {
    const outputDir = process.env.TSIO_CYPRESS_ATTEMPTS_DIR;
    if (!outputDir || !results) {
        return;
    }

    const specPath = spec.relative.replace(/\\/g, '/');
    const key = createHash('sha256').update(specPath).digest('hex');
    fs.mkdirSync(outputDir, {recursive: true});
    fs.writeFileSync(path.join(outputDir, `${key}.json`), JSON.stringify({
        schema_version: 1,
        spec_path: specPath,
        tests: results.tests,
    }));
};
