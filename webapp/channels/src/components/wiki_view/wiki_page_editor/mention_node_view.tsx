// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {NodeViewProps} from '@tiptap/react';
import {NodeViewWrapper} from '@tiptap/react';
import React from 'react';

import AtMention from 'components/at_mention';

const MentionNodeView = ({node, extension}: NodeViewProps) => {
    const username = node.attrs.label ?? node.attrs.id;
    const userId = node.attrs.id;
    const channelId = extension.options.channelId;

    return (
        <NodeViewWrapper
            as='span'
            className='mention'
            data-type='mention'
            data-id={userId}
        >
            <AtMention
                mentionName={username}
                channelId={channelId}
                fetchMissingUsers={true}
            />
        </NodeViewWrapper>
    );
};

export default MentionNodeView;
