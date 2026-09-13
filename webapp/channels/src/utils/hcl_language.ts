// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HLJSApi, Language, Mode} from 'highlight.js';

// highlight.js v11 no longer bundles a grammar for HCL / Terraform, so we vendor a
// small self-contained definition here instead of pulling in a third-party package.
// See https://github.com/mattermost/mattermost/issues/33870
//
// The default export matches highlight.js' LanguageFn contract, so it can be passed
// straight to hljs.registerLanguage() by the loader in syntax_highlighting.tsx.

/* eslint-disable new-cap */

export default function hcl(hljs: HLJSApi): Language {
    const interpolation: Mode = {
        className: 'subst',
        begin: /\$\{/,
        end: /\}/,
    };

    const stringMode: Mode = {
        className: 'string',
        begin: '"',
        end: '"',
        contains: [interpolation],
    };

    const heredocMode: Mode = {
        className: 'string',
        begin: /<<-?\s*["']?[A-Za-z][A-Za-z0-9_]*["']?/,
        end: /^\s*[A-Za-z][A-Za-z0-9_]*/,
    };

    const attributeMode: Mode = {
        className: 'attr',
        begin: /[A-Za-z_][A-Za-z0-9_-]*\s*(?==)/,
    };

    return {
        name: 'HCL',
        aliases: ['terraform', 'tf'],
        keywords: {
            keyword: 'resource variable provider output locals module data terraform for_each count depends_on lifecycle dynamic',
            literal: 'true false null',
        },
        contains: [
            hljs.COMMENT('#', '$'),
            hljs.COMMENT('//', '$'),
            hljs.COMMENT('/\\*', '\\*/'),
            hljs.NUMBER_MODE,
            stringMode,
            heredocMode,
            attributeMode,
        ],
    };
}
