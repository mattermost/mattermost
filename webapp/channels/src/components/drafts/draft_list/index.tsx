// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {getDraftRemotes, type Draft} from 'selectors/drafts';

import EmptyDraftList from './empty_draft_list';
import VirtualizedDraftList from './virtualized_draft_list';

type Props = {
    drafts: Draft[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
}

export default function DraftList(props: Props) {
    const draftRemotes = useSelector(getDraftRemotes);

    if (props.drafts.length === 0) {
        return <EmptyDraftList/>;
    }

    return (
        <VirtualizedDraftList
            drafts={props.drafts}
            currentUser={props.currentUser}
            userDisplayName={props.userDisplayName}
            userStatus={props.userStatus}
            draftRemotes={draftRemotes}
        />
    );
}
