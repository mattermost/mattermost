// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'node:fs';
import path from 'node:path';

const filesToCopy = [
    {
        src: '../../channels/src/packages/mattermost-redux/src/selectors/create_selector/index.d.ts',
        dest: 'lib/selectors/create_selector/index.d.ts'
    },
    {
        src: '../../channels/src/packages/mattermost-redux/src/types/extend_redux.d.ts',
        dest: 'lib/types/extend_redux.d.ts'
    },
    {
        src: '../../channels/src/packages/mattermost-redux/src/types/extend_react_redux.d.ts',
        dest: 'lib/types/extend_react_redux.d.ts'
    }
];

filesToCopy.forEach(({src, dest}) => {
    const srcPath = path.resolve(src);
    const destPath = path.resolve(dest);

    try {
        if (!fs.existsSync(path.dirname(destPath))) {
            fs.mkdirSync(path.dirname(destPath), {recursive: true});
        }
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${src} to ${dest}`);
    } catch (err) {
        console.error(`Failed to copy ${src} to ${dest}:`, err.message);
        process.exit(1);
    }
});
