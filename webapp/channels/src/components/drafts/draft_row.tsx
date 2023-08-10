// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import ChannelDraft from './channel_draft';
import ThreadDraft from './thread_draft';

import type {UserProfile, UserStatus} from '@mattermost/types/users';
import type {Draft} from 'selectors/drafts';

type Props = {
    user: UserProfile;
    status: UserStatus['status'];
    displayName: string;
    draft: Draft;
    isRemote?: boolean;
}

function DraftRow({draft, user, status, displayName, isRemote}: Props) {
    switch (draft.type) {
    case 'channel':
        return (
            <ChannelDraft
                {...draft}
                draftId={String(draft.key)}
                user={user}
                status={status}
                displayName={displayName}
                isRemote={isRemote}
            />
        );
    case 'thread':
        return (
            <ThreadDraft
                {...draft}
                rootId={draft.id}
                draftId={String(draft.key)}
                user={user}
                status={status}
                displayName={displayName}
                isRemote={isRemote}
            />
        );
    default:
        return null;
    }
}

export default memo(DraftRow);
