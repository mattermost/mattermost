// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, ReactNode, RefObject} from 'react';
import {Overlay} from 'react-bootstrap';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import classNames from 'classnames';

import type {Channel, ChannelMembership, ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserCustomStatus, UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import {memoizeResult} from 'mattermost-redux/utils/helpers';
import {displayUsername, isGuest} from 'mattermost-redux/utils/user_utils';

import {ChannelHeaderDropdown} from 'components/channel_header_dropdown';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusText from 'components/custom_status/custom_status_text';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import LocalizedIcon from 'components/localized_icon';
import Markdown from 'components/markdown';
import OverlayTrigger from 'components/overlay_trigger';
import type {BaseOverlayTrigger} from 'components/overlay_trigger';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import StatusIcon from 'components/status_icon';
import Timestamp from 'components/timestamp';
import Tooltip from 'components/tooltip';
import ArchiveIcon from 'components/widgets/icons/archive_icon';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import Popover from 'components/widgets/popover';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import CallButton from 'plugins/call_button';
import ChannelHeaderPlug from 'plugins/channel_header_plug';
import {
    Constants,
    ModalIdentifiers,
    NotificationLevels,
    RHSStates,
} from 'utils/constants';
import {t} from 'utils/i18n';
import {handleFormattedTextClick, localizeMessage, isEmptyObject, toTitleCase} from 'utils/utils';

import type {ModalData} from 'types/actions';
import type {RhsState} from 'types/store/rhs';

import ChannelInfoButton from './channel_info_button';
import HeaderIconWrapper from './components/header_icon_wrapper';

const headerMarkdownOptions = {singleline: true, mentionHighlight: false, atMentions: true};
const popoverMarkdownOptions = {singleline: false, mentionHighlight: false, atMentions: true};

export type Props = {
    teamId: string;
    currentUser: UserProfile;
    channel: Channel;
    memberCount?: number;
    channelMember?: ChannelMembership;
    dmUser?: UserProfile;
    gmMembers?: UserProfile[];
    isFavorite?: boolean;
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
        favoriteChannel: (channelId: string) => void;
        unfavoriteChannel: (channelId: string) => void;
        showPinnedPosts: (channelId?: string) => void;
        showChannelFiles: (channelId: string) => void;
        closeRightHandSide: () => void;
        getCustomEmojisInText: (text: string) => void;
        updateChannelNotifyProps: (userId: string, channelId: string, props: Partial<ChannelNotifyProps>) => void;
        goToLastViewedChannel: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
        closeModal: () => void;
        showChannelMembers: (channelId: string, inEditingMode?: boolean) => void;
    };
    teammateNameDisplaySetting: string;
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
    titleMenuOpen: boolean;
    showChannelHeaderPopover: boolean;
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
            leftOffset: 0,
            topOffset: 0,
            titleMenuOpen: false,
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

    toggleFavorite = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (this.props.isFavorite) {
            this.props.actions.unfavoriteChannel(this.props.channel.id);
        } else {
            this.props.actions.favoriteChannel(this.props.channel.id);
        }
    };

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
        } else {
            this.props.actions.showChannelFiles(this.props.channel.id);
        }
    };

    removeTooltipLink = () => {
        // Bootstrap adds the attr dynamically, removing it to prevent a11y readout
        this.toggleFavoriteRef.current?.removeAttribute('aria-describedby');
    };

    setTitleMenuOpen = (open: boolean) => this.setState({titleMenuOpen: open});

    showEditChannelHeaderModal = () => {
        if (this.headerOverlayRef.current) {
            this.headerOverlayRef.current.hide();
        }

        const {actions, channel} = this.props;
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
                this.setState({showChannelHeaderPopover: true, leftOffset: this.headerDescriptionRef.current?.offsetLeft || 0});
            }
        }

        // add 40px to take the global header into account
        const topOffset = (announcementBarSize * this.props.announcementBarCount) + 40;

        this.setState({topOffset});
    };

    toggleChannelMembersRHS = () => {
        if (this.props.rhsState === RHSStates.CHANNEL_MEMBERS) {
            this.props.actions.closeRightHandSide();
        } else {
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
            isFavorite,
            dmUser,
            rhsState,
            hasGuests,
            teammateNameDisplaySetting,
            hideGuestTags,
        } = this.props;
        const {formatMessage} = this.props.intl;
        const ariaLabelChannelHeader = localizeMessage('accessibility.sections.channelHeader', 'channel header region');

        let hasGuestsText: ReactNode = '';
        if (hasGuests && !hideGuestTags) {
            hasGuestsText = (
                <span className='has-guest-header'>
                    <span tabIndex={0}>
                        <FormattedMessage
                            id='channel_header.channelHasGuests'
                            defaultMessage='This channel has guests'
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

        let channelTitle: ReactNode = channel.display_name;
        const archivedIcon = channelIsArchived ? <ArchiveIcon className='icon icon__archive icon channel-header-archived-icon svg-text-color'/> : null;
        let sharedIcon = null;
        if (channel.shared) {
            sharedIcon = (
                <SharedChannelIndicator
                    className='shared-channel-icon'
                    channelType={channel.type}
                    withTooltip={true}
                />
            );
        }
        const isDirect = (channel.type === Constants.DM_CHANNEL);
        const isGroup = (channel.type === Constants.GM_CHANNEL);
        const isPrivate = (channel.type === Constants.PRIVATE_CHANNEL);

        if (isDirect) {
            const teammateId = dmUser?.id;
            if (currentUser.id === teammateId) {
                channelTitle = (
                    <FormattedMessage
                        id='channel_header.directchannel.you'
                        defaultMessage='{displayname} (you) '
                        values={{
                            displayname: displayUsername(dmUser, teammateNameDisplaySetting),
                        }}
                    />
                );
            } else {
                channelTitle = displayUsername(dmUser, teammateNameDisplaySetting) + ' ';
            }
            channelTitle = (
                <React.Fragment>
                    {channelTitle}
                    {isGuest(dmUser?.roles ?? '') && <GuestTag/>}
                </React.Fragment>
            );
        }

        if (isGroup) {
            // map the displayname to the gm member users
            const membersMap: Record<string, UserProfile[]> = {};
            if (gmMembers) {
                for (const user of gmMembers) {
                    if (user.id === currentUser.id) {
                        continue;
                    }
                    const userDisplayName = displayUsername(user, this.props.teammateNameDisplaySetting);

                    if (!membersMap[userDisplayName]) {
                        membersMap[userDisplayName] = []; //Create an array for cases with same display name
                    }

                    membersMap[userDisplayName].push(user);
                }
            }

            const displayNames = channel.display_name.split(', ');

            channelTitle = displayNames.map((displayName, index) => {
                if (!membersMap[displayName]) {
                    return displayName;
                }

                const user = membersMap[displayName].shift();

                return (
                    <React.Fragment key={user?.id}>
                        {index > 0 && ', '}
                        {displayName}
                        {isGuest(user?.roles ?? '') && <GuestTag/>}
                    </React.Fragment>
                );
            });

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

        let dmHeaderIconStatus: ReactNode;
        let dmHeaderTextStatus: ReactNode;
        if (isDirect && !dmUser?.delete_at && !dmUser?.is_bot) {
            dmHeaderIconStatus = (<StatusIcon status={channel.status}/>);

            dmHeaderTextStatus = (
                <span className='header-status__text'>
                    <FormattedMessage
                        id={`status_dropdown.set_${channel.status}`}
                        defaultMessage={toTitleCase(channel.status || '')}
                    />
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

        const channelFilesIconClass = classNames('channel-header__icon channel-header__icon--wide channel-header__icon--left', {
            'channel-header__icon--active': rhsState === RHSStates.CHANNEL_FILES,
        });
        const channelFilesIcon = <i className='icon icon-file-text-outline'/>;
        const pinnedIconClass = classNames('channel-header__icon channel-header__icon--wide channel-header__icon--left', {
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
            const membersIconClass = classNames('member-rhs__trigger channel-header__icon channel-header__icon--left channel-header__icon--wide', {
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
                    ariaLabel={true}
                    buttonClass={membersIconClass}
                    buttonId={'member_rhs'}
                    onClick={this.toggleChannelMembersRHS}
                    tooltipKey={'channelMembers'}
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
                    style={{transform: `translate(${this.state.leftOffset}px, ${this.state.topOffset}px)`}}
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
                    {dmHeaderIconStatus}
                    {dmHeaderTextStatus}
                    {memberListButton}

                    <HeaderIconWrapper
                        iconComponent={pinnedIcon}
                        ariaLabel={true}
                        buttonClass={pinnedIconClass}
                        buttonId={'channelHeaderPinButton'}
                        onClick={this.showPinnedPosts}
                        tooltipKey={'pinnedPosts'}
                    />
                    {this.props.isFileAttachmentsEnabled &&
                        <HeaderIconWrapper
                            iconComponent={channelFilesIcon}
                            ariaLabel={true}
                            buttonClass={channelFilesIconClass}
                            buttonId={'channelHeaderFilesButton'}
                            onClick={this.showChannelFiles}
                            tooltipKey={'channelFiles'}
                        />
                    }
                    {hasGuestsText}
                    <div
                        className='header-popover-text-measurer'
                        ref={this.headerPopoverTextMeasurerRef}
                    >
                        <Markdown
                            message={headerText.replace(/\n+/g, ' ')}
                            options={this.getHeaderMarkdownOptions(channelNamesMap)}
                            imageProps={imageProps}
                        /></div>
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
                            ref={this.headerOverlayRef}
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
                                <LocalizedIcon
                                    className='icon icon-pencil-outline edit-icon'
                                    ariaLabel={{id: t('channel_header.editLink'), defaultMessage: 'Edit'}}
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
                                <LocalizedIcon
                                    className='icon icon-pencil-outline edit-icon'
                                    ariaLabel={{id: t('channel_header.editLink'), defaultMessage: 'Edit'}}
                                />
                            </button>
                        </ChannelPermissionGate>
                    );
                }
            }
            headerTextContainer = (
                <div
                    id='channelHeaderDescription'
                    className='channel-header__description light'
                >
                    {dmHeaderIconStatus}
                    {dmHeaderTextStatus}
                    {memberListButton}

                    <HeaderIconWrapper
                        iconComponent={pinnedIcon}
                        ariaLabel={true}
                        buttonClass={pinnedIconClass}
                        buttonId={'channelHeaderPinButton'}
                        onClick={this.showPinnedPosts}
                        tooltipKey={'pinnedPosts'}
                    />
                    {this.props.isFileAttachmentsEnabled &&
                        <HeaderIconWrapper
                            iconComponent={channelFilesIcon}
                            ariaLabel={true}
                            buttonClass={channelFilesIconClass}
                            buttonId={'channelHeaderFilesButton'}
                            onClick={this.showChannelFiles}
                            tooltipKey={'channelFiles'}
                        />
                    }
                    {hasGuestsText}
                    {editMessage}
                </div>
            );
        }

        let toggleFavoriteTooltip;
        let toggleFavorite = null;
        let ariaLabel = '';

        if (!channelIsArchived) {
            const formattedMessage = isFavorite ? {
                id: 'channelHeader.removeFromFavorites',
                defaultMessage: 'Remove from Favorites',
            } : {
                id: 'channelHeader.addToFavorites',
                defaultMessage: 'Add to Favorites',
            };

            ariaLabel = formatMessage(formattedMessage).toLowerCase();
            toggleFavoriteTooltip = (
                <Tooltip id='favoriteTooltip' >
                    <FormattedMessage
                        {...formattedMessage}
                    />
                </Tooltip>
            );

            toggleFavorite = (
                <OverlayTrigger
                    key={`isFavorite-${isFavorite}`}
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={toggleFavoriteTooltip}
                    onEntering={this.removeTooltipLink}
                >
                    <button
                        id='toggleFavorite'
                        ref={this.toggleFavoriteRef}
                        onClick={this.toggleFavorite}
                        className={'style--none color--link channel-header__favorites ' + (this.props.isFavorite ? 'active' : 'inactive')}
                        aria-label={ariaLabel}
                    >
                        <i className={'icon ' + (this.props.isFavorite ? 'icon-star' : 'icon-star-outline')}/>
                    </button>
                </OverlayTrigger>
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
                        className={'style--none color--link channel-header__mute inactive'}
                        aria-label={formatMessage({id: 'generic_icons.muted', defaultMessage: 'Muted Icon'})}
                    >
                        <i className={'icon icon-bell-off-outline'}/>
                    </button>
                </OverlayTrigger>
            );
        }

        let title = (
            <React.Fragment>
                <MenuWrapper onToggle={this.setTitleMenuOpen}>
                    <div
                        id='channelHeaderDropdownButton'
                        className='channel-header__top'
                    >
                        <button
                            className={`channel-header__trigger style--none ${this.state.titleMenuOpen ? 'active' : ''}`}
                            aria-label={formatMessage({id: 'channel_header.menuAriaLabel', defaultMessage: 'Channel Menu'}).toLowerCase()}
                        >
                            <strong
                                role='heading'
                                aria-level={2}
                                id='channelHeaderTitle'
                                className='heading'
                            >
                                <span>
                                    {archivedIcon}
                                    {channelTitle}
                                    {sharedIcon}
                                </span>
                            </strong>
                            <span
                                id='channelHeaderDropdownIcon'
                                className='icon icon-chevron-down header-dropdown-chevron-icon'
                            />
                        </button>
                    </div>
                    <ChannelHeaderDropdown/>
                </MenuWrapper>
                {toggleFavorite}
            </React.Fragment>
        );
        if (isDirect && dmUser?.is_bot) {
            title = (
                <div
                    id='channelHeaderDropdownButton'
                    className='channel-header__top channel-header__bot'
                >
                    <strong
                        role='heading'
                        aria-level={2}
                        id='channelHeaderTitle'
                        className='heading'
                    >
                        <span>
                            {archivedIcon}
                            {channelTitle}
                        </span>
                    </strong>
                    <BotTag/>
                    {toggleFavorite}
                </div>
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
                                <div>
                                    {title}
                                </div>
                                {muteTrigger}
                            </div>
                            {headerTextContainer}
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
