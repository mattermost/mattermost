// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Custom Rollup plugin that uses the modern Sass API (sass.compile)
 * instead of the deprecated legacy API (sass.renderSync).
 * Also handles plain CSS imports.
 */

import * as sass from 'sass';
import path from 'path';
import fs from 'fs';
import {createFilter} from '@rollup/pluginutils';

export default function sassModern(options = {}) {
    const scssFilter = createFilter(options.include || ['**/*.scss', '**/*.sass'], options.exclude);
    const cssFilter = createFilter(['**/*.css'], options.exclude);
    const extractedStyles = new Map();

    return {
        name: 'sass-modern',

        transform(code, id) {
            // Handle SCSS/Sass files with modern Sass API
            if (scssFilter(id)) {
                try {
                    // Use the modern Sass API (sass.compile)
                    const result = sass.compile(id, {
                        loadPaths: [path.dirname(id), 'node_modules'],
                        sourceMap: options.sourceMap !== false,
                        style: options.outputStyle || 'expanded',
                    });

                    extractedStyles.set(id, result.css);

                    // Return empty module - CSS will be extracted
                    return {
                        code: 'export default ""',
                        map: null,
                    };
                } catch (error) {
                    this.error(`Error compiling ${id}: ${error.message}`);
                }
            }

            // Handle plain CSS files
            if (cssFilter(id)) {
                try {
                    const css = fs.readFileSync(id, 'utf-8');
                    extractedStyles.set(id, css);

                    return {
                        code: 'export default ""',
                        map: null,
                    };
                } catch (error) {
                    this.error(`Error reading CSS ${id}: ${error.message}`);
                }
            }

            return null;
        },

        generateBundle(outputOptions, bundle) {
            if (extractedStyles.size === 0) {
                return;
            }

            // Concatenate all extracted CSS
            const css = Array.from(extractedStyles.values()).join('\n');

            // Emit CSS file
            const fileName = options.fileName || 'index.esm.css';
            this.emitFile({
                type: 'asset',
                fileName,
                source: css,
            });
        },
    };
}
