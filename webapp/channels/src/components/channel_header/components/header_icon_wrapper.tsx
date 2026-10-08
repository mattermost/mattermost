// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import type {ShortcutDefinition} from '@mattermost/shared/components/tooltip';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import NewChannelWithBoardTourTip from 'components/app_bar/new_channel_with_board_tour_tip';

import {suitePluginIds} from 'utils/constants';

type Props = {

    /**
     * ariaLabelOverride lets you override the aria-label which would otherwise use the tooltip text. This typically
     * shouldn't be needed.
     */
    ariaLabelOverride?: string;

    buttonClass?: string;
    buttonId: string;
    children: React.ReactNode;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    tooltip: string;
    tooltipShortcut?: ShortcutDefinition;
    isRhsOpen?: boolean;
    pluginId?: string;
};

const LEGACY_BTN_CLASSES = /\b(btn|btn-icon|btn-xs|btn-sm|btn-md|btn-lg)\b/g;

const HeaderIconWrapper = (props: Props) => {
    const {
        ariaLabelOverride,
        buttonClass,
        buttonId,
        children,
        onClick,
        tooltip: tooltipText,
        tooltipShortcut,
        isRhsOpen,
        pluginId,
    } = props;

    const boardsEnabled = pluginId === suitePluginIds.focalboard;

    const ariaLabelText = ariaLabelOverride ?? tooltipText;

    const cleanedClassName = (buttonClass ?? 'channel-header__icon')
        .replace(LEGACY_BTN_CLASSES, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return (
        <>
            <WithTooltip
                title={isRhsOpen ? '' : tooltipText}
                shortcut={tooltipShortcut}
            >
                <IconButton
                    id={buttonId}
                    size='small'
                    className={cleanedClassName}
                    icon={children}
                    onClick={onClick}
                    aria-label={ariaLabelText}
                />
            </WithTooltip>
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
