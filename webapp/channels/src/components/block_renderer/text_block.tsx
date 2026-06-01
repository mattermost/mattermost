// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useContext} from 'react';

import type {MmTextBlock} from '@mattermost/types/mm_blocks';

import Markdown from 'components/markdown';

import {MmBlocksInlineMarkdownActionsContext, MmBlocksInteractionsDisabledContext} from './context';

type TextBlockProps = {block: MmTextBlock; postId: string};

function mmTextBlockClassNames(block: MmTextBlock): string {
    return classNames('mm-blocks-text', {
        'mm-blocks-text--subtle': block.is_subtle,
        'mm-blocks-text--small': block.size === 'small',
    });
}

export const TextBlock = ({block, postId}: TextBlockProps) => {
    const {mmBlocksActionCookie, integrationFormat} = useContext(MmBlocksInlineMarkdownActionsContext);
    const interactionsDisabled = useContext(MmBlocksInteractionsDisabledContext);
    if (!block.text) {
        return null;
    }
    return (
        <div className={mmTextBlockClassNames(block)}>
            <Markdown
                message={block.text}
                postId={postId}
                allowInlineActions={!interactionsDisabled}
                mmBlocksActionCookie={mmBlocksActionCookie}
                integrationFormat={integrationFormat}
            />
        </div>
    );
};
