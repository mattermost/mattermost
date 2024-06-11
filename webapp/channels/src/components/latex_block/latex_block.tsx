// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KatexOptions} from 'katex';
import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

type Katex = typeof import('katex');

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
        import('katex').then((katex) => {
            setKatex(katex.default);
        });
    }, []);

    if (!enableLatex || katex === undefined) {
        return (
            <div
                className='post-body--code tex'
                data-testid='latex-disabled'
            >
                {content}
            </div>
        );
    }

    try {
        const katexOptions: KatexOptions = {
            throwOnError: false,
            displayMode: true,
            maxSize: 200,
            maxExpand: 100,
            fleqn: true,
        };

        const html = katex.renderToString(content, katexOptions);

        return (
            <div
                className='post-body--code tex'
                dangerouslySetInnerHTML={{__html: html}}
                data-testid='latex-enabled'
            />
        );
    } catch (e) {
        // This is never run because throwOnError is false
        return (
            <div
                className='post-body--code tex'
                data-testid='latex-error'
            >
                <FormattedMessage
                    id='katex.error'
                    defaultMessage={'Couldn\'t compile your Latex code. Please review the syntax and try again.'}
                />
            </div>
        );
    }
};

export default React.memo(LatexBlock);
