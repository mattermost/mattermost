// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';

import classNames from 'classnames';

import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import SharedUserIndicator from 'components/shared_user_indicator';
import Avatar from 'components/widgets/users/avatar';
import Tag from 'components/widgets/tag/tag';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import StatusIcon from 'components/status_icon';

import Suggestion from '../suggestion.jsx';

import {UserProfile} from '@mattermost/types/users';

interface Item extends UserProfile {
    display_name: string;
    name: string;
    isCurrentUser: boolean;
    type: string;
}

interface Group extends Item {
    member_count: number;
}

class AtMentionSuggestion extends Suggestion {
    render() {
        const {intl} = this.props;
        const {isSelection, item} = this.props;

        let itemname: string;
        let description: ReactNode;
        let icon: JSX.Element;
        let customStatus: ReactNode;
        if (item.username === 'all') {
            itemname = 'all';
            description = (
                <FormattedMessage
                    id='suggestion.mention.all'
                    defaultMessage='Notifies everyone in this channel'
                />
            );
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i
                        className='icon icon-account-multiple-outline'
                        title={intl.formatMessage({id: 'generic_icons.member', defaultMessage: 'Member Icon'})}
                    />
                </span>
            );
        } else if (item.username === 'channel') {
            itemname = 'channel';
            description = (
                <FormattedMessage
                    id='suggestion.mention.channel'
                    defaultMessage='Notifies everyone in this channel'
                />
            );
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i
                        className='icon icon-account-multiple-outline'
                        title={intl.formatMessage({id: 'generic_icons.member', defaultMessage: 'Member Icon'})}
                    />
                </span>
            );
        } else if (item.username === 'here') {
            itemname = 'here';
            description = (
                <FormattedMessage
                    id='suggestion.mention.here'
                    defaultMessage='Notifies everyone online in this channel'
                />
            );
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i
                        className='icon icon-account-multiple-outline'
                        title={intl.formatMessage({id: 'generic_icons.member', defaultMessage: 'Member Icon'})}
                    />
                </span>
            );
        } else if (item.type === Constants.MENTION_GROUPS) {
            itemname = item.name;
            description = (
                <span className='ml-1'>{'- '}{item.display_name}</span>
            );
            icon = (
                <span className='suggestion-list__icon suggestion-list__icon--large'>
                    <i
                        className='icon icon-account-multiple-outline'
                        title={intl.formatMessage({id: 'generic_icons.member', defaultMessage: 'Member Icon'})}
                    />
                </span>
            );
        } else {
            itemname = item.username;

            if (item.isCurrentUser) {
                if (item.first_name || item.last_name) {
                    description = Utils.getFullName(item);
                }
            } else if (item.first_name || item.last_name || item.nickname) {
                description = `${Utils.getFullName(item)} ${item.nickname ? `(${item.nickname})` : ''}`.trim();
            }

            icon = (
                <span className='status-wrapper style--none'>
                    <span className='profile-icon'>
                        <Avatar
                            username={item && item.username}
                            size='sm'
                            url={Utils.imageURLForUser(item.id, item.last_picture_update)}
                        />
                    </span>
                    <StatusIcon status={item && item.status}/>
                </span>
            );

            customStatus = (
                <CustomStatusEmoji
                    showTooltip={true}
                    userID={item.id}
                    emojiSize={15}
                    emojiStyle={{
                        margin: '0 4px 4px',
                    }}
                />
            );
        }

        const youElement = item.isCurrentUser ? (
            <FormattedMessage
                id='suggestion.user.isCurrent'
                defaultMessage='(you)'
            />
        ) : null;

        const sharedIcon = item.remote_id ? (
            <SharedUserIndicator
                className='shared-user-icon'
                withTooltip={true}
            />
        ) : null;

        let countBadge;
        if (item.type === Constants.MENTION_GROUPS) {
            countBadge = (
                <span className='suggestion-list__group-count'>
                    <Tag
                        text={
                            <FormattedMessage
                                id='suggestion.group.members'
                                defaultMessage='{member_count} {member_count, plural, one {member} other {members}}'
                                values={{
                                    member_count: (item as Group).member_count,
                                }}
                            />
                        }
                    />
                </span>
            );
        }

        return (
            <div
                className={classNames('suggestion-list__item', {'suggestion--selected': isSelection})}
                data-testid={`mentionSuggestion_${itemname}`}
                onClick={this.handleClick}
                onMouseMove={this.handleMouseMove}
                {...Suggestion.baseProps}
            >
                {icon}
                <span className='suggestion-list__ellipsis'>
                    <span className='suggestion-list__main'>
                        {'@' + itemname}
                    </span>
                    {item.is_bot && <BotTag/>}
                    {description}
                    {youElement}
                    {customStatus}
                    {sharedIcon}
                    {isGuest(item.roles) && <GuestTag/>}
                </span>
                {countBadge}
            </div>
        );
    }
}

export default injectIntl(AtMentionSuggestion);
