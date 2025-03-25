// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import type {Draft} from 'selectors/drafts';

import EmptyDraftList from './empty_draft_list';
import VirtualizedDraftList from './virtualized_draft_list';

type Props = {
    drafts?: Draft[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: string;
    draftRemotes: Record<string, boolean>;
}

export default function DraftList(props: Props) {
    if (props.drafts?.length === 0) {
        return <EmptyDraftList/>;
    }

    return (
        <VirtualizedDraftList
            drafts={props.drafts as Draft[]}
            currentUser={props.currentUser}
            userDisplayName={props.userDisplayName}
            userStatus={props.userStatus}
            draftRemotes={props.draftRemotes}
        />
    );
}
