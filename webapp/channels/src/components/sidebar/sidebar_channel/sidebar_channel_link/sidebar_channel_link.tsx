// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link} from 'react-router-dom';
import classNames from 'classnames';

import Pluggable from 'plugins/pluggable';

import {mark, trackEvent} from 'actions/telemetry_actions';

import CopyUrlContextMenu from 'components/copy_url_context_menu';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants, {RHSStates} from 'utils/constants';
import {wrapEmojis} from 'utils/emoji_utils';
import {cmdOrCtrlPressed} from 'utils/keyboard';
import {isDesktopApp} from 'utils/user_agent';
import {localizeMessage} from 'utils/utils';
import {ChannelsAndDirectMessagesTour} from 'components/tours/onboarding_tour';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';

import ChannelMentionBadge from '../channel_mention_badge';
import ChannelPencilIcon from '../channel_pencil_icon';
import SidebarChannelIcon from '../sidebar_channel_icon';
import SidebarChannelMenu from '../sidebar_channel_menu';

import {Channel} from '@mattermost/types/channels';
import {RhsState} from 'types/store/rhs';

type Props = {
    channel: Channel;
    link: string;
    label: string;
    ariaLabelPrefix?: string;
    channelLeaveHandler?: (callback: () => void) => void;
    icon: JSX.Element | null;

    /**
     * Number of unread mentions in this channel
     */
    unreadMentions: number;

    /**
     * Whether or not the channel is shown as unread
     */
    isUnread: boolean;

    /**
     * Checks if the current channel is muted
     */
    isMuted: boolean;

    isChannelSelected: boolean;

    teammateId?: string;

    firstChannelName?: string;

    showChannelsTutorialStep: boolean;

    hasUrgent: boolean;
    rhsState?: RhsState;
    rhsOpen?: boolean;

    actions: {
        markMostRecentPostInChannelAsUnread: (channelId: string) => void;
        clearChannelSelection: () => void;
        multiSelectChannelTo: (channelId: string) => void;
        multiSelectChannelAdd: (channelId: string) => void;
        unsetEditingPost: () => void;
        closeRightHandSide: () => void;
    };
};

type State = {
    isMenuOpen: boolean;
    showTooltip: boolean;
};

export default class SidebarChannelLink extends React.PureComponent<Props, State> {
    labelRef: React.RefObject<HTMLDivElement>;
    gmItemRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.labelRef = React.createRef();
        this.gmItemRef = React.createRef();

        this.state = {
            isMenuOpen: false,
            showTooltip: false,
        };
    }

    componentDidMount(): void {
        this.enableToolTipIfNeeded();
    }

    componentDidUpdate(prevProps: Props): void {
        if (prevProps.label !== this.props.label) {
            this.enableToolTipIfNeeded();
        }
    }

    enableToolTipIfNeeded = (): void => {
        const element = this.gmItemRef.current || this.labelRef.current;
        const showTooltip = element && element.offsetWidth < element.scrollWidth;
        this.setState({showTooltip: Boolean(showTooltip)});
    };

    getAriaLabel = (): string => {
        const {label, ariaLabelPrefix, unreadMentions} = this.props;

        let ariaLabel = label;

        if (ariaLabelPrefix) {
            ariaLabel += ` ${ariaLabelPrefix}`;
        }

        if (unreadMentions === 1) {
            ariaLabel += ` ${unreadMentions} ${localizeMessage('accessibility.sidebar.types.mention', 'mention')}`;
        } else if (unreadMentions > 1) {
            ariaLabel += ` ${unreadMentions} ${localizeMessage('accessibility.sidebar.types.mentions', 'mentions')}`;
        }

        if (this.props.isUnread && unreadMentions === 0) {
            ariaLabel += ` ${localizeMessage('accessibility.sidebar.types.unread', 'unread')}`;
        }

        return ariaLabel.toLowerCase();
    };

    // Bootstrap adds the attr dynamically, removing it to prevent a11y readout
    removeTooltipLink = (): void => this.gmItemRef.current?.removeAttribute?.('aria-describedby');

    handleChannelClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
        mark('SidebarChannelLink#click');
        this.handleSelectChannel(event);

        if (this.props.rhsOpen && this.props.rhsState === RHSStates.EDIT_HISTORY) {
            this.props.actions.closeRightHandSide();
        }

        setTimeout(() => {
            trackEvent('ui', 'ui_channel_selected_v2');
        }, 0);
    };

    handleSelectChannel = (event: React.MouseEvent<HTMLAnchorElement>): void => {
        if (event.defaultPrevented || event.button !== 0) {
            return;
        }

        if (cmdOrCtrlPressed(event as unknown as React.KeyboardEvent)) {
            event.preventDefault();
            this.props.actions.multiSelectChannelAdd(this.props.channel.id);
        } else if (event.shiftKey) {
            event.preventDefault();
            this.props.actions.multiSelectChannelTo(this.props.channel.id);
        } else if (event.altKey && !this.props.isUnread) {
            event.preventDefault();
            this.props.actions.markMostRecentPostInChannelAsUnread(this.props.channel.id);
        } else {
            this.props.actions.clearChannelSelection();
        }
    };

    handleMenuToggle = (isMenuOpen: boolean) => {
        this.setState({isMenuOpen});
    };

    render(): JSX.Element {
        const {
            channel,
            icon,
            isChannelSelected,
            isMuted,
            isUnread,
            label,
            link,
            unreadMentions,
            firstChannelName,
            showChannelsTutorialStep,
            hasUrgent,
        } = this.props;

        let channelsTutorialTip: JSX.Element | null = null;

        // firstChannelName is based on channel.name,
        // but we want to display `display_name` to the user, so we check against `.name` for channel equality but pass in the .display_name value
        if (firstChannelName === channel.name || (!firstChannelName && showChannelsTutorialStep && channel.name === Constants.DEFAULT_CHANNEL)) {
            channelsTutorialTip = firstChannelName ? (<ChannelsAndDirectMessagesTour firstChannelName={channel.display_name}/>) : <ChannelsAndDirectMessagesTour/>;
        }

        let labelElement: JSX.Element = (
            <span className='SidebarChannelLinkLabel'>
                {wrapEmojis(label)}
            </span>
        );
        if (this.state.showTooltip) {
            const displayNameToolTip = (
                <Tooltip id='channel-displayname__tooltip'>
                    {label}
                </Tooltip>
            );
            labelElement = (
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={displayNameToolTip}
                    onEntering={this.removeTooltipLink}
                >
                    <div
                        className='truncated'
                        ref={this.gmItemRef}
                    >
                        {labelElement}
                    </div>
                </OverlayTrigger>
            );
        }

        const customStatus = this.props.teammateId ? (
            <CustomStatusEmoji
                userID={this.props.teammateId}
                showTooltip={true}
                spanStyle={{
                    height: 18,
                }}
                emojiStyle={{
                    marginTop: -4,
                    marginLeft: 6,
                    marginBottom: 0,
                    opacity: 0.8,
                }}
            />
        ) : null;

        const content = (
            <>
                <SidebarChannelIcon
                    isDeleted={channel.delete_at !== 0}
                    icon={icon}
                />
                <div
                    className='SidebarChannelLinkLabel_wrapper'
                    ref={this.labelRef}
                >
                    {labelElement}
                    {customStatus}
                    <Pluggable
                        pluggableName='SidebarChannelLinkLabel'
                        channel={this.props.channel}
                    />
                </div>
                <ChannelPencilIcon id={channel.id}/>
                <ChannelMentionBadge
                    unreadMentions={unreadMentions}
                    hasUrgent={hasUrgent}
                />
                <div
                    className={classNames(
                        'SidebarMenu',
                        'MenuWrapper',
                        {menuOpen: this.state.isMenuOpen},
                        {'MenuWrapper--open': this.state.isMenuOpen},
                    )}
                >
                    <SidebarChannelMenu
                        channel={channel}
                        channelLink={link}
                        isUnread={isUnread}
                        channelLeaveHandler={this.props.channelLeaveHandler}
                        onMenuToggle={this.handleMenuToggle}
                    />
                </div>
            </>
        );

        // NOTE: class added to temporarily support the desktop app's at-mention DOM scraping of the old sidebar
        const className = classNames([
            'SidebarLink',
            {
                menuOpen: this.state.isMenuOpen,
                muted: isMuted,
                'unread-title': this.props.isUnread,
                selected: isChannelSelected,
            },
        ]);
        let element = (
            <Link
                className={className}
                id={`sidebarItem_${channel.name}`}
                aria-label={this.getAriaLabel()}
                to={link}
                onClick={this.handleChannelClick}
                tabIndex={0}
            >
                {content}
                {channelsTutorialTip}
            </Link>
        );

        if (isDesktopApp()) {
            element = (
                <CopyUrlContextMenu
                    link={this.props.link}
                    menuId={channel.id}
                >
                    {element}
                </CopyUrlContextMenu>
            );
        }

        return element;
    }
}
