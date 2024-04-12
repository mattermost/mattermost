// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import NewChannelWithBoardTourTip from 'components/app_bar/new_channel_with_board_tour_tip';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import {Constants, suitePluginIds} from 'utils/constants';

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
        isRhsOpen,
        pluginId,
    } = props;

    let tooltipComponent;
    if (pluginId) {
        tooltipComponent = (
            <Tooltip
                id='pluginTooltip'
                className=''
            >
                <span>{tooltipText}</span>
            </Tooltip>
        );
    } else {
        tooltipComponent = (
            <Tooltip
                id={buttonId + '-tooltip'}
                className=''
            >
                <span>{tooltipText}</span>
            </Tooltip>
        );
    }

    const boardsEnabled = pluginId === suitePluginIds.focalboard;

    const ariaLabelText = ariaLabelOverride ?? tooltipText;

    return (
        <div>
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='bottom'
                overlay={isRhsOpen ? <></> : tooltipComponent}
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
};

export default HeaderIconWrapper;
