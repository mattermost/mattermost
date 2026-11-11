// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// tsc keeps side-effect imports like `import './emoji.css';` in the declaration files it emits. Those files don't
// exist next to the declarations, so consumers on TypeScript 6+ get TS2882 unless they enable skipLibCheck.

import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const dir = process.argv[2];

for (const entry of readdirSync(dir, {recursive: true})) {
    if (!entry.endsWith('.d.ts')) {
        continue;
    }

    const file = join(dir, entry);
    const contents = readFileSync(file, 'utf8');
    const stripped = contents.replace(/^import ['"][^'"]+\.s?css['"];\n/gm, '');
    if (stripped !== contents) {
        writeFileSync(file, stripped);
    }
}
