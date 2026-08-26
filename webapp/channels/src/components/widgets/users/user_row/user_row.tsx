// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import type {UserProfile} from '@mattermost/types/users';

import ProfilePopover from 'components/profile_popover';
import StatusIcon from 'components/status_icon';
import Avatar from 'components/widgets/users/avatar';

import * as Utils from 'utils/utils';

export type Props = {
    userId: UserProfile['id'];
    username?: string;
    displayName: string;

    /**
     * Rendered over the avatar. Omit to render no presence indicator at all.
     */
    status?: string;

    /**
     * Suppresses the status shown inside the profile popover, as bots have none.
     */
    hideStatus?: boolean;

    /**
     * Rendered after the name, inside the popover trigger. Used by callers that
     * reserve space for an adjacent control.
     */
    trailing?: React.ReactNode;
};

// A user's avatar and name, opening their profile popover when clicked. Shared by
// the group member list and the avatar overflow popover so the two lists cannot
// drift apart.
const UserRow = ({userId, username, displayName, status, hideStatus, trailing}: Props) => {
    const imageUrl = Utils.imageURLForUser(userId);

    return (
        <ProfilePopover
            userId={userId}
            src={imageUrl}
            hideStatus={hideStatus}
        >
            <UserButton>
                <span className='status-wrapper'>
                    <Avatar
                        username={username}
                        size='sm'
                        url={imageUrl}
                        className='avatar-post-preview'
                        tabIndex={-1}
                    />
                    {status ? <StatusIcon status={status}/> : null}
                </span>
                <Username className='overflow--ellipsis text-nowrap'>{displayName}</Username>
                {trailing}
            </UserButton>
        </ProfilePopover>
    );
};

const UserButton = styled.button`
    display: flex;
    width: 100%;
    padding: 5px 20px;
    border: none;
    background: unset;
    text-align: unset;
    align-items: center;
`;

const Username = styled.span`
    padding-left: 12px;
    flex: 1 1 auto;
`;

export default React.memo(UserRow);
