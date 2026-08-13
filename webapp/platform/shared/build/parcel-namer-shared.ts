// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as path from 'node:path';

import {Namer} from '@parcel/plugin';
import type {FilePath} from '@parcel/types';

/**
 * This Namer changes how Parcel outputs its files to put them into subfolders based on where they were originally in
 * the source folder.
 *
 * By default, files output by Parcel are not put into subfolders of dist, and they instead rely on hashes to
 * differentiate between them. We want to be able to import those directly, so
 */
export default new Namer({
    async name(opts): Promise<FilePath | null | undefined> {
        const {bundle} = opts;

        const mainEntry = bundle.getMainEntry();
        if (!mainEntry) {
            return null;
        }

        // Get the relative file path within the source folder
        const relativeDir = path.posix.relative('./src', path.dirname(mainEntry.filePath));

        let filename;
        if (bundle.type === 'js') {
            // Rename generated JS files from FILE.js to FILE.TARGET.js or FILE.TARGET.js to fix naming conflict
            // between CommonJS and ESM files
            filename = path.basename(mainEntry.filePath, path.extname(mainEntry.filePath));
            filename += '.' + bundle.target.name + '.js';
        } else if (bundle.type === 'ts') {
            filename = path.basename(mainEntry.filePath, path.extname(mainEntry.filePath)) + '.d.ts';
        } else {
            filename = bundle.target.name + path.extname(mainEntry.filePath);
        }

        const newPath = path.posix.join(relativeDir, filename);

        return newPath;
    },
});
