// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AdvancedCreateComment from 'components/advanced_create_comment';

import type {PostDraft} from 'types/store/draft';

type Props = {
    placeholder?: string;
    onSubmit: (draft: PostDraft) => void;
}

const ExportedCreatePost = ({placeholder, onSubmit}: Props) => {
    const Component = AdvancedCreateComment as any;

    return (
        <Component
            placeholder={placeholder}
            rootDeleted={false}
            channelId={undefined}
            rootId={undefined}
            latestPostId={undefined}
            onSubmit={onSubmit}
            onUpdateCommentDraft={() => null}
            updateCommentDraftWithRootId={() => null}
            onMoveHistoryIndexBack={() => null}
            onMoveHistoryIndexForward={() => null}
            onEditLatestPost={() => ({data: true})}
        />
    );
};

export default ExportedCreatePost;
