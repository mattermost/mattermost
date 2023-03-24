// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link} from 'react-router-dom';

import {ConnectedComponent} from 'react-redux';

import BotTag from 'components/widgets/tag/bot_tag';

import {Client4} from 'mattermost-redux/client';

import {UserProfile} from '@mattermost/types/users';
import {Channel, ChannelMembership} from '@mattermost/types/channels';
import {ServerError} from '@mattermost/types/errors';

import * as Utils from 'utils/utils';
import ProfilePicture from 'components/profile_picture';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';

type Props = {
    user: UserProfile;
    status?: string;
    extraInfo?: Array<string | JSX.Element>;
    actions?: Array<ConnectedComponent<any, any>>;
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
    actionUserProps?: {
        [userId: string]: {
            channel: Channel;
            teamMember: any;
            channelMember: ChannelMembership;
        };
    };
    index?: number;
    userCount?: number;
    totalUsers?: number;
    isDisabled?: boolean;
}
type State = {
    error?: ServerError;
}

export default class UserListRowWithError extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {};
    }

    onError = (errorObj: ServerError) => {
        this.setState({
            error: errorObj,
        });
    }

    render(): JSX.Element {
        let buttons = null;
        if (this.props.actions) {
            buttons = this.props.actions.map((Action, index) => {
                return (
                    <Action
                        key={index.toString()}
                        user={this.props.user}
                        index={this.props.index}
                        totalUsers={this.props.totalUsers}
                        {...this.props.actionProps}
                        {...this.props.actionUserProps}
                        onError={this.onError}
                    />
                );
            });
        }

        // QUICK HACK, NEEDS A PROP FOR TOGGLING STATUS
        let email: React.ReactNode = this.props.user.email;
        let emailStyle = 'more-modal__description';
        let status;
        if (this.props.user.is_bot) {
            email = null;
        } else if (this.props.extraInfo && this.props.extraInfo.length > 0) {
            email = (
                <FormattedMarkdownMessage
                    id='admin.user_item.emailTitle'
                    defaultMessage='**Email:** {email}'
                    values={{
                        email: this.props.user.email,
                    }}
                />
            );
            emailStyle = '';
        } else {
            status = this.props.status;
        }

        if (this.props.user.is_bot) {
            status = null;
        }

        let userCountID = null;
        let userCountEmail = null;
        if (this.props.userCount && this.props.userCount >= 0) {
            userCountID = Utils.createSafeId('userListRowName' + this.props.userCount);
            userCountEmail = Utils.createSafeId('userListRowEmail' + this.props.userCount);
        }

        let error = null;
        if (this.state.error) {
            error = (
                <div className='has-error'>
                    <label className='has-error control-label'>{this.state.error.message}</label>
                </div>
            );
        }

        return (
            <div
                data-testid='userListRow'
                key={this.props.user.id}
                className='more-modal__row'
            >
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(this.props.user.id, this.props.user.last_picture_update)}
                    status={status || undefined}
                    size='md'
                />
                <div className='more-modal__right'>
                    <div className='more-modal__top'>
                        <div className='more-modal__details'>
                            <div
                                id={userCountID || undefined}
                                className='more-modal__name'
                            >
                                <Link to={'/admin_console/user_management/user/' + this.props.user.id}>
                                    {Utils.displayEntireNameForUser(this.props.user)}
                                </Link>
                                <CustomStatusEmoji
                                    userID={this.props.user.id}
                                    showTooltip={true}
                                    emojiSize={16}
                                    emojiStyle={{
                                        marginLeft: '8px',
                                    }}
                                />

                                {this.props.user.is_bot && <BotTag/>}
                            </div>
                            <div
                                id={userCountEmail || undefined}
                                className={emailStyle}
                            >
                                {email}
                            </div>
                            {this.props.extraInfo}
                        </div>
                        <div
                            className='more-modal__actions'
                        >
                            {buttons}
                        </div>
                    </div>
                    <div
                        className='more-modal__bottom'
                    >
                        {error}
                    </div>
                </div>
            </div>
        );
    }
}
