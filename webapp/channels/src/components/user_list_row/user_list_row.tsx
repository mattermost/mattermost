// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';
import type {ConnectedComponent} from 'react-redux';
import styled from 'styled-components';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {TeamMembership} from '@mattermost/types/teams';
import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import Nbsp from 'components/html_entities/nbsp';
import ProfilePicture from 'components/profile_picture';
import UserProfile from 'components/user_profile';

import {createSafeId, displayFullAndNicknameForUser} from 'utils/utils';

const CustomStatus = styled.span`
    margin: auto 0;
    padding-left: 8px;
    span {
        display: flex;
    }
`;

type Props = {
    user: UserProfileType;
    status?: string;
    extraInfo?: Array<string | JSX.Element>;
    actions?: Array<ConnectedComponent<any, any>>;
    actionProps?: {
        mfaEnabled: boolean;
        enableUserAccessTokens: boolean;
        experimentalEnableAuthenticationTransfer: boolean;
        doPasswordReset: (user: UserProfileType) => void;
        doEmailReset: (user: UserProfileType) => void;
        doManageTeams: (user: UserProfileType) => void;
        doManageRoles: (user: UserProfileType) => void;
        doManageTokens: (user: UserProfileType) => void;
        isDisabled?: boolean;
    };
    actionUserProps?: {
        [userId: string]: {
            channel: Channel;
            teamMember: TeamMembership;
            channelMember: ChannelMembership;
        };
    };
    index?: number;
    totalUsers?: number;
    userCount?: number;
};

const UserListRow = ({user, status, extraInfo = [], actions = [], actionProps, actionUserProps = {}, index, totalUsers, userCount}: Props) => {
    let buttons = null;
    if (actions) {
        buttons = actions.map((Action, actionIndex) => {
            return (
                <Action
                    key={actionIndex.toString()}
                    user={user}
                    index={index}
                    totalUsers={totalUsers}
                    {...actionProps}
                    {...actionUserProps}
                />
            );
        });
    }

    // QUICK HACK, NEEDS A PROP FOR TOGGLING STATUS
    let emailProp: ReactNode = user.email;
    let emailStyle = 'more-modal__description';
    let statusProp: string | undefined;
    if (extraInfo && extraInfo.length > 0) {
        emailProp = (
            <FormattedMessage
                id='admin.user_item.email_title'
                defaultMessage='<strong>Email:</strong> {email}'
                values={{
                    email: user.email,
                    strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                }}
            />
        );
        emailStyle = '';
    } else if (user.status) {
        statusProp = user.status;
    } else {
        statusProp = status;
    }

    if (user.is_bot) {
        statusProp = undefined;
        emailProp = undefined;
    }

    let userCountID: string | undefined;
    let userCountEmail: string | undefined;
    if (userCount && userCount >= 0) {
        userCountID = createSafeId('userListRowName' + userCount);
        userCountEmail = createSafeId('userListRowEmail' + userCount);
    }

    return (
        <div
            key={user.id}
            className='more-modal__row'
        >
            <ProfilePicture
                src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                status={statusProp}
                size='md'
                userId={user.id}
                username={user.username}
            />
            <div
                className='more-modal__details'
                data-testid='userListItemDetails'
            >
                <div className='d-flex whitespace--nowrap'>
                    <div
                        id={userCountID}
                        className='more-modal__name'
                    >
                        <UserProfile
                            userId={user.id}
                            displayUsername={true}
                        />
                        {
                            (user.first_name || user.last_name || user.nickname) && (
                                <>
                                    <Nbsp/>
                                    {'-'}
                                    <Nbsp/>
                                    {
                                        displayFullAndNicknameForUser(user)
                                    }
                                </>
                            )
                        }

                    </div>
                    <CustomStatus>
                        <CustomStatusEmoji
                            userID={user.id}
                            emojiSize={16}
                            showTooltip={true}
                            spanStyle={{
                                display: 'flex',
                                flex: '0 0 auto',
                                alignItems: 'center',
                            }}
                        />
                    </CustomStatus>

                </div>
                <div
                    id={userCountEmail}
                    className={emailStyle}
                >
                    {emailProp}
                </div>
                {extraInfo}
            </div>
            <div
                data-testid='userListItemActions'
                className='more-modal__actions'
            >
                {buttons}
            </div>
        </div>
    );
};

export default UserListRow;
