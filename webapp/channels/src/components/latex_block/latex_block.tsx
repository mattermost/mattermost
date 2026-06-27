// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KatexOptions} from 'katex';
import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import CodeBlock from 'components/code_block/code_block';

type Katex = typeof import('katex').default;

type Props = {
    content: string;
    enableLatex?: boolean;
};

const LatexBlock = ({
    content,
    enableLatex,
}: Props) => {
    const [katex, setKatex] = useState<Katex | undefined>();

    useEffect(() => {
        // issue #34109: load the mhchem extension alongside KaTeX so chemistry
        // macros like \ce and \pu register on the same module instance the
        // renderer uses. Without this, `$$\ce{H2O}$$` falls back to KaTeX's
        // unknown-command path and renders \ce in red with H2O as plain math.
        Promise.all([
            import('katex'),
            import('katex/contrib/mhchem'),
        ]).then(([katex]) => {
            setKatex(katex.default);
        });
    }, []);

    if (!enableLatex || katex === undefined) {
        return (
            <CodeBlock
                code={content}
                language='latex'
            />
        );
    }

    const katexOptions: KatexOptions = {
        throwOnError: false,
        displayMode: true,
        maxSize: 200,
        maxExpand: 100,
        fleqn: true,
    };

    let html;
    try {
        html = katex.renderToString(content, katexOptions);
    } catch {
        // This is never run because throwOnError is false
        return (
            <div
                className='post-body--code tex'
                data-testid='latex-error'
            >
                <FormattedMessage
                    id='katex.error'
                    defaultMessage="Couldn't compile your Latex code. Please review the syntax and try again."
                />
            </div>
        );
    }

    return (
        <div
            className='post-body--code tex'
            dangerouslySetInnerHTML={{__html: html}}
            data-testid='latex-enabled'
        />
    );
};

export default React.memo(LatexBlock);
