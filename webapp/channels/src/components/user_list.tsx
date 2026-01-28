// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useRef} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import LoadingScreen from 'components/loading_screen';

import UserListRow from './user_list_row';

type Props = {
    rowComponentType?: React.ComponentType<any>;
    actions?: Array<React.ComponentType<any>>;
    actionUserProps?: {
        [userId: string]: {
            channel?: Channel;
            teamMember: TeamMembership;
            channelMember?: ChannelMembership;
        };
    };
    isDisabled?: boolean;
    users?: UserProfile[] | null;
    extraInfo?: {[key: string]: Array<string | JSX.Element>};
    actionProps?: {
        mfaEnabled: boolean;
        enableUserAccessTokens: boolean;
        experimentalEnableAuthenticationTransfer: boolean;
        doPasswordReset: (user: UserProfile) => void;
        doEmailReset: (user: UserProfile) => void;
        doManageTeams: (user: UserProfile) => void;
        doManageRoles: (user: UserProfile) => void;
        doManageTokens: (user: UserProfile) => void;
        isDisabled?: boolean;
    };
}

const UserList = ({
    actionUserProps,
    isDisabled,
    actionProps,
    users: usersFromProps = [],
    extraInfo = {},
    actions = [],
    rowComponentType = UserListRow,
}: Props) => {
    const containerRef = useRef(null);

    const users = usersFromProps;
    const RowComponentType = rowComponentType;

    let content;
    if (users == null) {
        return <LoadingScreen/>;
    } else if (users.length > 0 && RowComponentType && actionProps) {
        content = users.map((user: UserProfile, index: number) => {
            const userId = user.id;
            return (
                <RowComponentType
                    key={user.id}
                    user={user}
                    extraInfo={extraInfo?.[userId]}
                    actions={actions}
                    actionProps={actionProps}
                    actionUserProps={actionUserProps?.[userId]}
                    index={index}
                    totalUsers={users.length}
                    userCount={index >= 0 ? index : -1}
                    isDisabled={isDisabled}
                />
            );
        });
    } else {
        content = (
            <div
                key='no-users-found'
                className='more-modal__placeholder-row no-users-found'
                data-testid='noUsersFound'
            >
                <p>
                    <FormattedMessage
                        id='user_list.notFound'
                        defaultMessage='No users found'
                    />
                </p>
            </div>
        );
    }

    return (
        <div ref={containerRef}>
            {content}
        </div>
    );
};

export default memo(UserList);
