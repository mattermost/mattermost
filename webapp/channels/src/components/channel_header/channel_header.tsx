// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MouseEvent, ReactNode, RefObject} from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusText from 'components/custom_status/custom_status_text';
import Timestamp from 'components/timestamp';
import WithTooltip from 'components/with_tooltip';

import CallButton from 'plugins/call_button';
import ChannelHeaderPlug from 'plugins/channel_header_plug';
import {
    Constants,
    NotificationLevels,
    RHSStates,
} from 'utils/constants';
import {isEmptyObject} from 'utils/utils';

import ChannelHeaderText from './channel_header_text';
import ChannelHeaderTitle from './channel_header_title';
import ChannelInfoButton from './channel_info_button';
import HeaderIconWrapper from './components/header_icon_wrapper';

import type {PropsFromRedux} from './index';

export type Props = WrappedComponentProps & PropsFromRedux;

class ChannelHeader extends React.PureComponent<Props> {
    toggleFavoriteRef: RefObject<HTMLButtonElement>;

    constructor(props: Props) {
        super(props);
        this.toggleFavoriteRef = React.createRef();
    }

    componentDidMount() {
        this.props.actions.getCustomEmojisInText(this.props.channel ? this.props.channel.header : '');
    }

    componentDidUpdate(prevProps: Props) {
        const header = this.props.channel ? this.props.channel.header : '';
        const prevHeader = prevProps.channel ? prevProps.channel.header : '';
        if (header !== prevHeader) {
            this.props.actions.getCustomEmojisInText(header);
        }
    }

    unmute = () => {
        const {actions, channel, channelMember, currentUser} = this.props;

        if (!channelMember || !currentUser || !channel) {
            return;
        }

        const options = {mark_unread: NotificationLevels.ALL};
        actions.updateChannelNotifyProps(currentUser.id, channel.id, options);
    };

    showPinnedPosts = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (this.props.rhsState === RHSStates.PIN) {
            this.props.actions.closeRightHandSide();
        } else {
            this.props.actions.showPinnedPosts();
        }
    };

    showChannelFiles = () => {
        if (this.props.rhsState === RHSStates.CHANNEL_FILES) {
            this.props.actions.closeRightHandSide();
        } else if (this.props.channel) {
            this.props.actions.showChannelFiles(this.props.channel.id);
        }
    };

    toggleChannelMembersRHS = () => {
        if (this.props.rhsState === RHSStates.CHANNEL_MEMBERS) {
            this.props.actions.closeRightHandSide();
        } else if (this.props.channel) {
            this.props.actions.showChannelMembers(this.props.channel.id);
        }
    };

    renderCustomStatus = () => {
        const {customStatus, isCustomStatusEnabled, isCustomStatusExpired} = this.props;
        const isStatusSet = !isCustomStatusExpired && (customStatus?.text || customStatus?.emoji);
        if (!(isCustomStatusEnabled && isStatusSet)) {
            return null;
        }

        return (
            <div className='custom-emoji__wrapper'>
                <CustomStatusEmoji
                    userID={this.props.dmUser?.id}
                    showTooltip={true}
                    emojiStyle={{
                        verticalAlign: 'top',
                        margin: '0 4px 1px',
                    }}
                />
                <CustomStatusText
                    text={customStatus?.text}
                    className='custom-emoji__text'
                />
            </div>
        );
    };

    render() {
        const {
            teamId,
            currentUser,
            gmMembers,
            channel,
            channelMember,
            isChannelMuted,
            dmUser,
            rhsState,
            hasGuests,
            hideGuestTags,
        } = this.props;
        if (!channel) {
            return null;
        }

        const ariaLabelChannelHeader = this.props.intl.formatMessage({id: 'accessibility.sections.channelHeader', defaultMessage: 'channel header region'});

        let hasGuestsText: ReactNode = '';
        if (hasGuests && !hideGuestTags) {
            hasGuestsText = (
                <span className='has-guest-header'>
                    <span tabIndex={0}>
                        <FormattedMessage
                            id='channel_header.channelHasGuests'
                            defaultMessage='Channel has guests'
                        />
                    </span>
                </span>
            );
        }

        if (isEmptyObject(channel) ||
            isEmptyObject(channelMember) ||
            isEmptyObject(currentUser) ||
            (!dmUser && channel.type === Constants.DM_CHANNEL)
        ) {
            // Use an empty div to make sure the header's height stays constant
            return (
                <div className='channel-header'/>
            );
        }

        const isDirect = (channel.type === Constants.DM_CHANNEL);
        const isGroup = (channel.type === Constants.GM_CHANNEL);

        if (isGroup) {
            if (hasGuests && !hideGuestTags) {
                hasGuestsText = (
                    <span className='has-guest-header'>
                        <FormattedMessage
                            id='channel_header.groupMessageHasGuests'
                            defaultMessage='This group message has guests'
                        />
                    </span>
                );
            }
        }

        let dmHeaderTextStatus: ReactNode;
        if (isDirect && !dmUser?.delete_at && !dmUser?.is_bot) {
            dmHeaderTextStatus = (
                <span className='header-status__text'>
                    {this.renderCustomStatus()}
                </span>
            );

            if (this.props.isLastActiveEnabled && this.props.lastActivityTimestamp && this.props.timestampUnits) {
                dmHeaderTextStatus = (
                    <span className='header-status__text'>
                        <span className='last-active__text'>
                            <FormattedMessage
                                id='channel_header.lastActive'
                                defaultMessage='Active {timestamp}'
                                values={{
                                    timestamp: (
                                        <Timestamp
                                            value={this.props.lastActivityTimestamp}
                                            units={this.props.timestampUnits}
                                            useTime={false}
                                            style={'short'}
                                        />
                                    ),
                                }}
                            />
                        </span>
                        {this.renderCustomStatus()}
                    </span>
                );
            }
        }

        const channelFilesIconClass = classNames('channel-header__icon channel-header__icon--left btn btn-icon btn-xs ', {
            'channel-header__icon--active': rhsState === RHSStates.CHANNEL_FILES,
        });
        const channelFilesIcon = <i className='icon icon-file-text-outline'/>;
        const pinnedIconClass = classNames('channel-header__icon channel-header__icon--wide channel-header__icon--left btn btn-icon btn-xs', {
            'channel-header__icon--active': rhsState === RHSStates.PIN,
        });
        const pinnedIcon = this.props.pinnedPostsCount ? (
            <>
                <i
                    aria-hidden='true'
                    className='icon icon-pin-outline channel-header__pin'
                />
                <span
                    id='channelPinnedPostCountText'
                    className='icon__text'
                >
                    {this.props.pinnedPostsCount}
                </span>
            </>
        ) : (
            <i
                aria-hidden='true'
                className='icon icon-pin-outline channel-header__pin'
            />
        );

        const pinnedButton = this.props.pinnedPostsCount ? (
            <HeaderIconWrapper
                buttonClass={pinnedIconClass}
                buttonId={'channelHeaderPinButton'}
                onClick={this.showPinnedPosts}
                tooltip={this.props.intl.formatMessage({id: 'channel_header.pinnedPosts', defaultMessage: 'Pinned messages'})}
            >
                {pinnedIcon}
            </HeaderIconWrapper>
        ) : (
            null
        );

        let memberListButton = null;
        if (!isDirect) {
            const membersIconClass = classNames('member-rhs__trigger channel-header__icon channel-header__icon--wide channel-header__icon--left btn btn-icon btn-xs', {
                'channel-header__icon--active': rhsState === RHSStates.CHANNEL_MEMBERS,
            });
            const membersIcon = this.props.memberCount ? (
                <>
                    <i
                        aria-hidden='true'
                        className='icon icon-account-outline channel-header__members'
                    />
                    <span
                        id='channelMemberCountText'
                        className='icon__text'
                    >
                        {this.props.memberCount}
                    </span>
                </>
            ) : (
                <>
                    <i
                        aria-hidden='true'
                        className='icon icon-account-outline channel-header__members'
                    />
                    <span
                        id='channelMemberCountText'
                        className='icon__text'
                    >
                        {'-'}
                    </span>
                </>
            );

            memberListButton = (
                <HeaderIconWrapper
                    tooltip={this.props.intl.formatMessage({id: 'channel_header.channelMembers', defaultMessage: 'Members'})}
                    buttonClass={membersIconClass}
                    buttonId={'member_rhs'}
                    onClick={this.toggleChannelMembersRHS}
                >
                    {membersIcon}
                </HeaderIconWrapper>
            );
        }

        let muteTrigger;
        if (isChannelMuted) {
            muteTrigger = (
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='channelHeader.unmute'
                            defaultMessage='Unmute'
                        />
                    }
                >
                    <button
                        id='toggleMute'
                        onClick={this.unmute}
                        className={'channel-header__mute inactive btn btn-icon btn-xs'}
                        aria-label={this.props.intl.formatMessage({id: 'channelHeader.unmute', defaultMessage: 'Unmute'})}
                    >
                        <i
                            className={'icon icon-bell-off-outline'}
                            aria-hidden={true}
                        />
                    </button>
                </WithTooltip>
            );
        }

        return (
            <div
                id='channel-header'
                aria-label={ariaLabelChannelHeader}
                role='banner'
                tabIndex={-1}
                data-channelid={`${channel.id}`}
                className='channel-header alt a11y__region'
                data-a11y-sort-order='8'
            >
                <div className='flex-parent'>
                    <div className='flex-child'>
                        <div
                            id='channelHeaderInfo'
                            className='channel-header__info'
                        >
                            <div
                                className='channel-header__title dropdown'
                            >
                                <ChannelHeaderTitle
                                    dmUser={dmUser}
                                    gmMembers={gmMembers}
                                />
                                <div
                                    className='channel-header__icons'
                                >
                                    {muteTrigger}
                                    {memberListButton}
                                    {pinnedButton}
                                    {this.props.isFileAttachmentsEnabled &&
                                        <HeaderIconWrapper
                                            buttonClass={channelFilesIconClass}
                                            buttonId={'channelHeaderFilesButton'}
                                            onClick={this.showChannelFiles}
                                            tooltip={this.props.intl.formatMessage({id: 'channel_header.channelFiles', defaultMessage: 'Channel files'})}
                                        >
                                            {channelFilesIcon}
                                        </HeaderIconWrapper>
                                    }
                                </div>
                                <div
                                    id='channelHeaderDescription'
                                    className='channel-header__description'
                                >
                                    {dmHeaderTextStatus}
                                    {hasGuestsText}
                                    <ChannelHeaderText
                                        teamId={teamId}
                                        channel={channel}
                                        dmUser={dmUser}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <ChannelHeaderPlug
                        channel={channel}
                        channelMember={channelMember}
                    />
                    <CallButton/>
                    <ChannelInfoButton channel={channel}/>
                </div>
            </div>
        );
    }
}

export default injectIntl(ChannelHeader);
