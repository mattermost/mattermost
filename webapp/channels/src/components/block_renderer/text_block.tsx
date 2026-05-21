// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';

import type {MmTextBlock} from '@mattermost/types/mm_blocks';

import Markdown from 'components/markdown';

import type {ActionHandler} from './types';

type TextBlockProps = {block: MmTextBlock; postId: string; onAction: ActionHandler};

function mmTextBlockClassNames(block: MmTextBlock): string {
    return classNames('mm-blocks-text', {
        'mm-blocks-text--subtle': block.is_subtle,
        'mm-blocks-text--small': block.size === 'small',
    });
}

export const TextBlock = ({block, postId, onAction}: TextBlockProps) => {
    const handleMmActionMarkdown = useCallback(
        (actionId: string, query: Record<string, string>) => {
            onAction(actionId, undefined, query, undefined);
        },
        [onAction],
    );
    if (!block.text) {
        return null;
    }
    return (
        <div className={mmTextBlockClassNames(block)}>
            <Markdown
                message={block.text}
                postId={postId}
                onMmBlocksMarkdownAction={handleMmActionMarkdown}
            />
        </div>
    );
};
