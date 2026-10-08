// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useLayoutEffect, useRef} from 'react';

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

    active?: boolean;
    buttonClass?: string;
    buttonId: string;

    /**
     * Numeric count shown after the icon via IconButton's count prop (Compass layout + typography).
     */
    count?: number;

    /**
     * Optional id applied to IconButton's count span for legacy e2e selectors.
     */
    countId?: string;

    children: React.ReactNode;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    tooltip: string;
    tooltipShortcut?: ShortcutDefinition;
    isRhsOpen?: boolean;
    pluginId?: string;
    size?: React.ComponentProps<typeof IconButton>['size'];
};

const LEGACY_BTN_CLASSES = /\b(btn|btn-icon|btn-xs|btn-sm|btn-md|btn-lg)\b/g;

const HeaderIconWrapper = (props: Props) => {
    const {
        active,
        ariaLabelOverride,
        buttonClass,
        buttonId,
        children,
        count,
        countId,
        onClick,
        tooltip: tooltipText,
        tooltipShortcut,
        isRhsOpen,
        pluginId,
        size = 'x-small',
    } = props;

    const buttonRef = useRef<HTMLButtonElement>(null);
    const boardsEnabled = pluginId === suitePluginIds.focalboard;

    const ariaLabelText = ariaLabelOverride ?? tooltipText;

    const cleanedClassName = (buttonClass ?? 'channel-header__icon').
        replace(LEGACY_BTN_CLASSES, '').
        replace(/\s{2,}/g, ' ').
        trim();

    // IconButton does not expose a count element id; set it for legacy Cypress selectors.
    useLayoutEffect(() => {
        if (!buttonRef.current || count === undefined || !countId) {
            return;
        }
        const countEl = buttonRef.current.children[1] as HTMLElement | undefined;
        if (countEl) {
            countEl.id = countId;
        }
    }, [count, countId]);

    return (
        <>
            <WithTooltip
                title={isRhsOpen ? '' : tooltipText}
                shortcut={tooltipShortcut}
            >
                <IconButton
                    ref={buttonRef}
                    id={buttonId}
                    size={size}
                    className={cleanedClassName}
                    icon={children}
                    count={count}
                    active={active}
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
