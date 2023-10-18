import React from 'react';

import type {PostDraft} from 'types/store/draft';

import AdvancedCreateComment from 'components/advanced_create_comment';

type Props = {
    placeholder?: string,
    onSubmit: (draft: PostDraft) => void;
}

const ExportedCreatePost = ({placeholder, onSubmit}: Props) => {
    return (
        <AdvancedCreateComment
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
    )
}

export default ExportedCreatePost;
