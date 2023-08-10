// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import NewChannelWithBoardTourTip from 'components/app_bar/new_channel_with_board_tour_tip';
import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import {Constants, suitePluginIds} from 'utils/constants';
import {t} from 'utils/i18n';
import {localizeMessage} from 'utils/utils';

import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

type Props = {
    ariaLabel?: boolean;
    buttonClass?: string;
    buttonId: string;
    iconComponent: React.ReactNode;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    tooltipKey: string;
    tooltipText?: React.ReactNode;
    isRhsOpen?: boolean;
    pluginId?: string;
}

type TooltipInfo = {
    class: string;
    id: string;
    messageID: string;
    message: string;
    keyboardShortcut?: KeyboardShortcutDescriptor;
}

const HeaderIconWrapper = (props: Props) => {
    const {
        ariaLabel,
        buttonClass,
        buttonId,
        iconComponent,
        onClick,
        tooltipKey,
        tooltipText,
        isRhsOpen,
        pluginId,
    } = props;

    const toolTips: Record<string, TooltipInfo> = {
        flaggedPosts: {
            class: 'text-nowrap',
            id: 'flaggedTooltip',
            messageID: t('channel_header.flagged'),
            message: 'Saved posts',
        },
        pinnedPosts: {
            class: 'pinned-posts',
            id: 'pinnedPostTooltip',
            messageID: t('channel_header.pinnedPosts'),
            message: 'Pinned posts',
        },
        recentMentions: {
            class: '',
            id: 'recentMentionsTooltip',
            messageID: t('channel_header.recentMentions'),
            message: 'Recent mentions',
            keyboardShortcut: KEYBOARD_SHORTCUTS.navMentions,
        },
        search: {
            class: '',
            id: 'searchTooltip',
            messageID: t('channel_header.search'),
            message: 'Search',
        },
        channelFiles: {
            class: 'channel-files',
            id: 'channelFilesTooltip',
            messageID: t('channel_header.channelFiles'),
            message: 'Channel files',
        },
        openChannelInfo: {
            class: 'channel-info',
            id: 'channelInfoTooltip',
            messageID: t('channel_header.openChannelInfo'),
            message: 'View Info',
        },
        closeChannelInfo: {
            class: 'channel-info',
            id: 'channelInfoTooltip',
            messageID: t('channel_header.closeChannelInfo'),
            message: 'Close info',
        },
        channelMembers: {
            class: 'channel-info',
            id: 'channelMembersTooltip',
            messageID: t('channel_header.channelMembers'),
            message: 'Members',
        },
    };

    function getTooltip(key: string) {
        if (toolTips[key] == null) {
            return null;
        }

        return (
            <Tooltip
                id={toolTips[key].id}
                className={toolTips[key].class}
            >
                <FormattedMessage
                    id={toolTips[key].messageID}
                    defaultMessage={toolTips[key].message}
                />
                {toolTips[key].keyboardShortcut &&
                    <KeyboardShortcutSequence
                        shortcut={toolTips[key].keyboardShortcut!}
                        hideDescription={true}
                        isInsideTooltip={true}
                    />
                }
            </Tooltip>
        );
    }

    let tooltip;
    if (tooltipKey === 'plugin' && tooltipText) {
        tooltip = (
            <Tooltip
                id='pluginTooltip'
                className=''
            >
                <span>{tooltipText}</span>
            </Tooltip>
        );
    } else {
        tooltip = getTooltip(tooltipKey);
    }

    let ariaLabelText;
    if (ariaLabel) {
        ariaLabelText = `${localizeMessage(toolTips[tooltipKey].messageID, toolTips[tooltipKey].message)}`;
    }

    const boardsEnabled = pluginId === suitePluginIds.focalboard;

    if (tooltip) {
        return (
            <div>
                <OverlayTrigger
                    trigger={['hover', 'focus']}
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={isRhsOpen ? <></> : tooltip}
                >
                    <button
                        id={buttonId}
                        aria-label={ariaLabelText}
                        className={buttonClass || 'channel-header__icon'}
                        onClick={onClick}
                    >
                        {iconComponent}
                    </button>
                </OverlayTrigger>
                {boardsEnabled &&
                    <NewChannelWithBoardTourTip
                        pulsatingDotPlacement={'start'}
                        pulsatingDotTranslate={{x: 0, y: -22}}
                    />
                }
            </div>
        );
    }

    return (
        <>
            <div className='flex-child'>
                <button
                    id={buttonId}
                    className={buttonClass || 'channel-header__icon'}
                    onClick={onClick}
                >
                    {iconComponent}
                </button>
            </div>
            {boardsEnabled &&
                <NewChannelWithBoardTourTip
                    pulsatingDotPlacement={'start'}
                    pulsatingDotTranslate={{x: 0, y: -22}}
                />
            }
        </>
    );
};

export default HeaderIconWrapper;
