// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MouseEvent, ReactNode, RefObject} from 'react';
import {Overlay} from 'react-bootstrap';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Channel, ChannelMembership, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserCustomStatus, UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {memoizeResult} from 'mattermost-redux/utils/helpers';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusText from 'components/custom_status/custom_status_text';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import Markdown from 'components/markdown';
import OverlayTrigger from 'components/overlay_trigger';
import type {BaseOverlayTrigger} from 'components/overlay_trigger';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import Timestamp from 'components/timestamp';
import Tooltip from 'components/tooltip';
import Popover from 'components/widgets/popover';

import CallButton from 'plugins/call_button';
import ChannelHeaderPlug from 'plugins/channel_header_plug';
import {
    Constants,
    ModalIdentifiers,
    NotificationLevels,
    RHSStates,
} from 'utils/constants';
import {handleFormattedTextClick, isEmptyObject} from 'utils/utils';

import type {ModalData} from 'types/actions';
import type {RhsState} from 'types/store/rhs';

import ChannelHeaderTitle from './channel_header_title';
import ChannelInfoButton from './channel_info_button';
import HeaderIconWrapper from './components/header_icon_wrapper';

const headerMarkdownOptions = {singleline: true, mentionHighlight: false, atMentions: true};
const popoverMarkdownOptions = {singleline: false, mentionHighlight: false, atMentions: true};

export type Props = {
    teamId: string;
    currentUser: UserProfile;
    channel?: Channel;
    memberCount?: number;
    channelMember?: ChannelMembership;
    dmUser?: UserProfile;
    gmMembers?: UserProfile[];
    isReadOnly?: boolean;
    isMuted?: boolean;
    hasGuests?: boolean;
    rhsState?: RhsState;
    rhsOpen?: boolean;
    isQuickSwitcherOpen?: boolean;
    intl: IntlShape;
    pinnedPostsCount?: number;
    hasMoreThanOneTeam?: boolean;
    actions: {
        showPinnedPosts: (channelId?: string) => void;
        showChannelFiles: (channelId: string) => void;
        closeRightHandSide: () => void;
        getCustomEmojisInText: (text: string) => void;
        updateChannelNotifyProps: (userId: string, channelId: string, props: Partial<ChannelNotifyProps>) => void;
        goToLastViewedChannel: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
        showChannelMembers: (channelId: string, inEditingMode?: boolean) => void;
    };
    currentRelativeTeamUrl: string;
    announcementBarCount: number;
    customStatus?: UserCustomStatus;
    isCustomStatusEnabled: boolean;
    isCustomStatusExpired: boolean;
    isFileAttachmentsEnabled: boolean;
    isLastActiveEnabled: boolean;
    timestampUnits?: string[];
    lastActivityTimestamp?: number;
    hideGuestTags: boolean;
};

type State = {
    showChannelHeaderPopover: boolean;
    channelHeaderPoverWidth: number;
    leftOffset: number;
    topOffset: number;
};

class ChannelHeader extends React.PureComponent<Props, State> {
    toggleFavoriteRef: RefObject<HTMLButtonElement>;
    headerDescriptionRef: RefObject<HTMLSpanElement>;
    headerPopoverTextMeasurerRef: RefObject<HTMLDivElement>;
    headerOverlayRef: RefObject<BaseOverlayTrigger>;
    getHeaderMarkdownOptions: (channelNamesMap: Record<string, any>) => Record<string, any>;
    getPopoverMarkdownOptions: (channelNamesMap: Record<string, any>) => Record<string, any>;

    constructor(props: Props) {
        super(props);
        this.toggleFavoriteRef = React.createRef();
        this.headerDescriptionRef = React.createRef();
        this.headerPopoverTextMeasurerRef = React.createRef();
        this.headerOverlayRef = React.createRef();

        this.state = {
            showChannelHeaderPopover: false,
            channelHeaderPoverWidth: 0,
            leftOffset: 0,
            topOffset: 0,
        };

        this.getHeaderMarkdownOptions = memoizeResult((channelNamesMap: Record<string, any>) => (
            {...headerMarkdownOptions, channelNamesMap}
        ));
        this.getPopoverMarkdownOptions = memoizeResult((channelNamesMap: Record<string, any>) => (
            {...popoverMarkdownOptions, channelNamesMap}
        ));
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

    handleClose = () => this.props.actions.goToLastViewedChannel();

    unmute = () => {
        const {actions, channel, channelMember, currentUser} = this.props;

        if (!channelMember || !currentUser || !channel) {
            return;
        }

        const options = {mark_unread: NotificationLevels.ALL};
        actions.updateChannelNotifyProps(currentUser.id, channel.id, options);
    };

    mute = () => {
        const {actions, channel, channelMember, currentUser} = this.props;

        if (!channelMember || !currentUser || !channel) {
            return;
        }

        const options = {mark_unread: NotificationLevels.MENTION};
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

    showEditChannelHeaderModal = () => {
        if (this.headerOverlayRef.current) {
            this.headerOverlayRef.current.hide();
        }

        const {actions, channel} = this.props;
        if (!channel) {
            return;
        }

        const modalData = {
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        };

        actions.openModal(modalData);
    };

    showChannelHeaderPopover = (headerText: string) => {
        const headerDescriptionRect = this.headerDescriptionRef.current?.getBoundingClientRect();
        const headerPopoverTextMeasurerRect = this.headerPopoverTextMeasurerRef.current?.getBoundingClientRect();
        const announcementBarSize = 40;

        if (headerPopoverTextMeasurerRect && headerDescriptionRect) {
            if (headerPopoverTextMeasurerRect.width > headerDescriptionRect.width || headerText.match(/\n{2,}/g)) {
                const leftOffset = headerDescriptionRect.left - (this.props.hasMoreThanOneTeam ? 313 : 248);
                this.setState({showChannelHeaderPopover: true, leftOffset});
            }
        }

        // add 40px to take the global header into account
        const topOffset = (announcementBarSize * this.props.announcementBarCount) + 40;
        const channelHeaderPoverWidth = this.headerDescriptionRef.current?.clientWidth || 0 - (this.props.hasMoreThanOneTeam ? 64 : 0);

        this.setState({topOffset});
        this.setState({channelHeaderPoverWidth});
    };

    toggleChannelMembersRHS = () => {
        if (this.props.rhsState === RHSStates.CHANNEL_MEMBERS) {
            this.props.actions.closeRightHandSide();
        } else if (this.props.channel) {
            this.props.actions.showChannelMembers(this.props.channel.id);
        }
    };

    handleFormattedTextClick = (e: MouseEvent<HTMLSpanElement>) => handleFormattedTextClick(e, this.props.currentRelativeTeamUrl);

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
                    tooltipDirection='bottom'
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
            isMuted: channelMuted,
            isReadOnly,
            dmUser,
            rhsState,
            hasGuests,
            hideGuestTags,
        } = this.props;
        if (!channel) {
            return null;
        }

        const {formatMessage} = this.props.intl;
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

        const channelIsArchived = channel.delete_at !== 0;
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

        const channelNamesMap = channel.props && channel.props.channel_mentions;

        const isDirect = (channel.type === Constants.DM_CHANNEL);
        const isGroup = (channel.type === Constants.GM_CHANNEL);
        const isPrivate = (channel.type === Constants.PRIVATE_CHANNEL);

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
                    iconComponent={membersIcon}
                    tooltip={this.props.intl.formatMessage({id: 'channel_header.channelMembers', defaultMessage: 'Members'})}
                    buttonClass={membersIconClass}
                    buttonId={'member_rhs'}
                    onClick={this.toggleChannelMembersRHS}
                />
            );
        }

        let headerTextContainer;
        const headerText = (isDirect && dmUser?.is_bot) ? dmUser.bot_description : channel.header;
        if (headerText) {
            const imageProps = {
                hideUtilities: true,
            };
            const popoverContent = (
                <Popover
                    id='header-popover'
                    popoverStyle='info'
                    popoverSize='lg'
                    style={{transform: `translate(${this.state.leftOffset}px, ${this.state.topOffset}px)`, maxWidth: this.state.channelHeaderPoverWidth + 16}}
                    placement='bottom'
                    className={classNames('channel-header__popover', {'chanel-header__popover--lhs_offset': this.props.hasMoreThanOneTeam})}
                >
                    <span
                        onClick={this.handleFormattedTextClick}
                    >
                        <Markdown
                            message={headerText}
                            options={this.getPopoverMarkdownOptions(channelNamesMap)}
                            imageProps={imageProps}
                        />
                    </span>
                </Popover>
            );

            headerTextContainer = (
                <div
                    id='channelHeaderDescription'
                    className='channel-header__description'
                    dir='auto'
                >
                    {dmHeaderTextStatus}
                    {hasGuestsText}
                    <div
                        className='header-popover-text-measurer'
                        ref={this.headerPopoverTextMeasurerRef}
                    >
                        <Markdown
                            message={headerText.replace(/\n+/g, ' ')}
                            options={this.getHeaderMarkdownOptions(channelNamesMap)}
                            imageProps={imageProps}
                        />
                    </div>
                    <span
                        className='header-description__text'
                        onClick={this.handleFormattedTextClick}
                        onMouseOver={() => this.showChannelHeaderPopover(headerText)}
                        onMouseOut={() => this.setState({showChannelHeaderPopover: false})}
                        ref={this.headerDescriptionRef}
                    >
                        <Overlay
                            show={this.state.showChannelHeaderPopover}
                            placement='bottom'
                            rootClose={true}
                            target={this.headerDescriptionRef.current as React.ReactInstance}
                            ref={this.headerOverlayRef as any}
                            onHide={() => this.setState({showChannelHeaderPopover: false})}
                        >
                            {popoverContent}
                        </Overlay>

                        <Markdown
                            message={headerText}
                            options={this.getHeaderMarkdownOptions(channelNamesMap)}
                            imageProps={imageProps}
                        />
                    </span>
                </div>
            );
        } else {
            let editMessage;
            if (!isReadOnly && !channelIsArchived) {
                if (isDirect || isGroup) {
                    if (!isDirect || !dmUser?.is_bot) {
                        editMessage = (
                            <button
                                className='header-placeholder style--none'
                                onClick={this.showEditChannelHeaderModal}
                            >
                                <FormattedMessage
                                    id='channel_header.addChannelHeader'
                                    defaultMessage='Add a channel header'
                                />
                                <i
                                    className='icon icon-pencil-outline edit-icon'
                                    aria-label={this.props.intl.formatMessage({id: 'channel_header.editLink', defaultMessage: 'Edit'})}
                                />
                            </button>
                        );
                    }
                } else {
                    editMessage = (
                        <ChannelPermissionGate
                            channelId={channel.id}
                            teamId={teamId}
                            permissions={[isPrivate ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES]}
                        >
                            <button
                                className='header-placeholder style--none'
                                onClick={this.showEditChannelHeaderModal}
                            >
                                <FormattedMessage
                                    id='channel_header.addChannelHeader'
                                    defaultMessage='Add a channel header'
                                />
                                <i
                                    className='icon icon-pencil-outline edit-icon'
                                    aria-label={this.props.intl.formatMessage({id: 'channel_header.editLink', defaultMessage: 'Edit'})}
                                />
                            </button>
                        </ChannelPermissionGate>
                    );
                }
            }
            headerTextContainer = (
                <div
                    id='channelHeaderDescription'
                    className='channel-header__description'
                >
                    {dmHeaderTextStatus}
                    {hasGuestsText}
                    {editMessage}
                </div>
            );
        }

        const channelMutedTooltip = (
            <Tooltip id='channelMutedTooltip'>
                <FormattedMessage
                    id='channelHeader.unmute'
                    defaultMessage='Unmute'
                />
            </Tooltip>
        );

        let muteTrigger;
        if (channelMuted) {
            muteTrigger = (
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={channelMutedTooltip}
                >
                    <button
                        id='toggleMute'
                        onClick={this.unmute}
                        className={'channel-header__mute inactive btn btn-icon btn-xs'}
                        aria-label={formatMessage({id: 'generic_icons.muted', defaultMessage: 'Muted Icon'})}
                    >
                        <i className={'icon icon-bell-off-outline'}/>
                    </button>
                </OverlayTrigger>
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
                                    <HeaderIconWrapper
                                        iconComponent={pinnedIcon}
                                        buttonClass={pinnedIconClass}
                                        buttonId={'channelHeaderPinButton'}
                                        onClick={this.showPinnedPosts}
                                        tooltip={this.props.intl.formatMessage({id: 'channel_header.pinnedPosts', defaultMessage: 'Pinned messages'})}
                                    />
                                    {this.props.isFileAttachmentsEnabled &&
                                        <HeaderIconWrapper
                                            iconComponent={channelFilesIcon}
                                            buttonClass={channelFilesIconClass}
                                            buttonId={'channelHeaderFilesButton'}
                                            onClick={this.showChannelFiles}
                                            tooltip={this.props.intl.formatMessage({id: 'channel_header.channelFiles', defaultMessage: 'Channel files'})}
                                        />
                                    }
                                </div>
                                {headerTextContainer}
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
