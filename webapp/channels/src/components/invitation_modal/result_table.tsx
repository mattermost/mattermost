// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import AlertIcon from 'components/widgets/icons/alert_icon';
import EmailIcon from 'components/widgets/icons/mail_icon';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import Avatar from 'components/widgets/users/avatar';

import {imageURLForUser, getLongDisplayName} from 'utils/utils';

import './result_table.scss';

type InviteNotSent = {
    text: React.ReactNode | React.ReactNodeArray;
}

type InviteEmail = {
    email: string;
}

type InviteUser = {
    user: UserProfile;
}

type I18nLike = {
    id: string;
    message: string;
    values?: Record<string, React.ReactNode>;
}

export type InviteResult = (InviteNotSent | InviteEmail | InviteUser) & {
    reason: string | I18nLike;
    path?: string;
}

export type Props = {
    sent?: boolean;
    rows: InviteResult[];
}

export default function ResultTable(props: Props) {
    const intl = useIntl();
    let wrapperClass = 'invitation-modal-confirm invitation-modal-confirm--not-sent';
    let header = (
        <h2>
            <FormattedMessage
                id='invitation_modal.confirm.not-sent-header'
                defaultMessage='Invitations Not Sent'
            />
        </h2>
    );
    if (props.sent) {
        wrapperClass = 'invitation-modal-confirm invitation-modal-confirm--sent';
        header = (
            <h2>
                <FormattedMessage
                    id='invitation_modal.confirm.sent-header'
                    defaultMessage='Successful Invites'
                />
            </h2>
        );
    }

    function messageWithLink(reason: any, link: any) {
        return intl.formatMessage(
            {
                id: reason.id,
                defaultMessage: reason.message,
            },
            {
                a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                    <a
                        href={link}
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            window.open(link);
                        }}
                    >
                        {chunks}
                    </a>
                ),
            },
        );
    }
    return (
        <div className={wrapperClass}>
            {header}
            <div className='InviteResultTable'>
                <div className='table-header'>
                    <div className='people-header'>
                        <FormattedMessage
                            id='invitation-modal.confirm.people-header'
                            defaultMessage='People'
                        />
                    </div>
                    <div className='details-header'>
                        <FormattedMessage
                            id='invitation-modal.confirm.details-header'
                            defaultMessage='Details'
                        />
                    </div>
                </div>
                <div className='rows'>
                    {props.rows.map((invitation: InviteResult) => {
                        let icon;
                        let username;
                        let className;
                        let guestBadge;
                        let botBadge;
                        let reactKey = '';

                        if (invitation.hasOwnProperty('user')) {
                            className = 'name';
                            const user = (invitation as InviteUser).user;
                            reactKey = user.id;
                            const profileImg = imageURLForUser(user.id, user.last_picture_update);
                            icon = (
                                <Avatar
                                    username={user.username}
                                    url={profileImg}
                                    size='lg'
                                />
                            );
                            username = getLongDisplayName(user);
                            if (user.is_bot) {
                                botBadge = <BotTag/>;
                            }
                            if (isGuest(user.roles)) {
                                guestBadge = <GuestTag/>;
                            }
                        } else if (invitation.hasOwnProperty('email')) {
                            const email = (invitation as InviteEmail).email;
                            reactKey = email;
                            className = 'email';
                            icon = <EmailIcon className='mail-icon'/>;
                            username = email;
                        } else {
                            const text = (invitation as InviteNotSent).text;
                            reactKey = typeof text === 'string' ? text : text?.toString() || 'result_table_unknown_text';
                            className = 'name';
                            icon = <AlertIcon className='alert-icon'/>;
                            username = text;
                        }

                        let reason: React.ReactNode = invitation.reason;
                        if (typeof invitation?.reason !== 'string' &&
                                invitation.reason?.id &&
                                    invitation.reason?.message &&
                                        invitation.reason?.values
                        ) {
                            reason = (
                                <FormattedMessage
                                    id={invitation.reason.id}
                                    defaultMessage={invitation.reason.message}
                                    values={invitation.reason.values}
                                />
                            );
                        } else if (invitation.path && invitation.reason) {
                            reason = messageWithLink(invitation.reason, invitation.path);
                        }

                        return (
                            <div
                                key={reactKey}
                                className='InviteResultRow'
                            >
                                <div className='username-or-icon'>
                                    {icon}
                                    <span className={className}>
                                        {username}
                                        {botBadge}
                                        {guestBadge}
                                    </span>
                                </div>
                                <div className='reason'>
                                    {reason}
                                </div>
                            </div>
                        );
                    })}

                </div>
            </div>
        </div>
    );
}
