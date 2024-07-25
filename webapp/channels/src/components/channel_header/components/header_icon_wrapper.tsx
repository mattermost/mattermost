// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import NewChannelWithBoardTourTip from 'components/app_bar/new_channel_with_board_tour_tip';
import WithTooltip from 'components/with_tooltip';
import type {ShortcutDefinition} from 'components/with_tooltip/shortcut';

import {suitePluginIds} from 'utils/constants';

type Props = {

    /**
     * ariaLabelOverride lets you override the aria-label which would otherwise use the tooltip text. This typically
     * shouldn't be needed.
     */
    ariaLabelOverride?: string;

    buttonClass?: string;
    buttonId: string;
    iconComponent: React.ReactNode;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    tooltip: string;
    tooltipShortcut?: ShortcutDefinition;
    isRhsOpen?: boolean;
    pluginId?: string;
}

const HeaderIconWrapper = (props: Props) => {
    const {
        ariaLabelOverride,
        buttonClass,
        buttonId,
        iconComponent,
        onClick,
        tooltip: tooltipText,
        tooltipShortcut,
        isRhsOpen,
        pluginId,
    } = props;

    const boardsEnabled = pluginId === suitePluginIds.focalboard;

    const ariaLabelText = ariaLabelOverride ?? tooltipText;

    return (
        <>
            <WithTooltip
                id={buttonId + '-tooltip'}
                placement='bottom'
                title={isRhsOpen ? '' : tooltipText}
                shortcut={tooltipShortcut}
            >
                <button
                    id={buttonId}
                    aria-label={ariaLabelText}
                    className={buttonClass || 'channel-header__icon'}
                    onClick={onClick}
                >
                    {iconComponent}
                </button>
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
