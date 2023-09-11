// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import SearchableUserList from './searchable_user_list';

type Props = {
    users: UserProfile[] | null;
    usersPerPage: number;
    total: number;
    extraInfo?: {[key: string]: Array<string | JSX.Element>};
    nextPage: (page: number) => void;
    search: (term: string) => void;
    actions?: React.ReactNode[];
    actionProps?: {
        mfaEnabled: boolean;
        enableUserAccessTokens: boolean;
        experimentalEnableAuthenticationTransfer: boolean;
        doPasswordReset: (user: UserProfile) => void;
        doEmailReset: (user: UserProfile) => void;
        doManageTeams: (user: UserProfile) => void;
        doManageRoles: (user: UserProfile) => void;
        doManageTokens: (user: UserProfile) => void;
        isDisabled: boolean | undefined;
    };
    actionUserProps: {
        [userId: string]: {
            channel?: Channel;
            teamMember: TeamMembership;
            channelMember?: ChannelMembership;
        };
    };
    focusOnMount?: boolean;
}

export default function SearchableUserListContainer(props: Props) {
    const [term, setTerm] = useState('');
    const [page, setPage] = useState(0);

    const handleTermChange = (term: string) => {
        setTerm(term);
    };

    const nextPage = () => {
        setPage(page + 1);
        props.nextPage(page + 1);
    };

    const previousPage = () => {
        setPage(page - 1);
    };

    const search = (term: string) => {
        props.search(term);

        if (term !== '') {
            setPage(0);
        }
    };

    return (
        <SearchableUserList
            {...props}
            nextPage={nextPage}
            previousPage={previousPage}
            search={search}
            page={page}
            term={term}
            onTermChange={handleTermChange}
        />
    );
}
