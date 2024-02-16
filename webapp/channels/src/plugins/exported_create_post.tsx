// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AdvancedCreateComment from 'components/advanced_create_comment';
import type {Props} from 'components/advanced_create_comment/advanced_create_comment';

const ExportedCreatePost = (props: Partial<Props>) => {
    const Component = AdvancedCreateComment as any;

    return (
        <Component
            placeholder={''}
            rootDeleted={false}
            channelId={undefined}
            rootId={undefined}
            latestPostId={undefined}
            onUpdateCommentDraft={() => null}
            updateCommentDraftWithRootId={() => null}
            onMoveHistoryIndexBack={() => null}
            onMoveHistoryIndexForward={() => null}
            onEditLatestPost={() => ({data: true})}
            isPlugin={true}
            {...props}
        />
    );
};

export default ExportedCreatePost;
