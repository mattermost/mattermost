// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * AppBarRhsPanel - Icon component for RHS panels in the AppBar
 *
 * Displays an icon button in the AppBar for an RHS panel. Supports:
 * - Active state highlighting when panel is visible
 * - Visual indicator for minimized panels (reduced opacity + dot)
 * - Appropriate icon for each panel type
 * - Keyboard accessibility (Enter/Space)
 * - Tooltip with panel title
 *
 * Usage:
 * ```tsx
 * import AppBarRhsPanel from 'components/app_bar/app_bar_rhs_panel';
 *
 * <AppBarRhsPanel
 *   panel={panelState}
 *   isActive={activePanelId === panelState.id}
 *   onRestore={(id) => dispatch(restoreRhsPanel(id))}
 *   onActivate={(id) => dispatch(setActivePanelId(id))}
 * />
 * ```
 */

import classNames from 'classnames';
import React, {useCallback} from 'react';

import {
    MessageTextOutlineIcon,
    MagnifyIcon,
    AtIcon,
    BookmarkOutlineIcon,
    PinOutlineIcon,
    FileMultipleOutlineIcon,
    InformationOutlineIcon,
    AccountMultipleOutlineIcon,
    PowerPlugOutlineIcon,
    ClockOutlineIcon,
    CloseIcon,
} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

import type {RhsPanelState} from 'types/store/rhs_panel';

type AppBarRhsPanelProps = {
    /** The RHS panel state to render */
    panel: RhsPanelState;

    /** Whether this panel is currently active (visible) */
    isActive: boolean;

    /** Whether to show the close button (when Alt is held) */
    showCloseButton: boolean;

    /** Callback when a minimized panel is clicked to restore it */
    onRestore: (panelId: string) => void;

    /** Callback when an active panel is clicked to minimize it */
    onMinimize: (panelId: string) => void;

    /** Callback when a non-active, non-minimized panel is clicked to activate it */
    onActivate: (panelId: string) => void;

    /** Callback when the close button is clicked */
    onClose: (panelId: string) => void;
}

/**
 * Returns the appropriate Compass icon component for a panel type.
 */
function getPanelIconComponent(type: RhsPanelState['type']) {
    switch (type) {
    case 'thread':
        return MessageTextOutlineIcon;
    case 'search':
        return MagnifyIcon;
    case 'mention':
        return AtIcon;
    case 'flag':
        return BookmarkOutlineIcon;
    case 'pin':
        return PinOutlineIcon;
    case 'channel_files':
        return FileMultipleOutlineIcon;
    case 'channel_info':
        return InformationOutlineIcon;
    case 'channel_members':
        return AccountMultipleOutlineIcon;
    case 'plugin':
        return PowerPlugOutlineIcon;
    case 'edit_history':
        return ClockOutlineIcon;
    default:
        return MessageTextOutlineIcon;
    }
}

const AppBarRhsPanel = ({
    panel,
    isActive,
    showCloseButton,
    onRestore,
    onMinimize,
    onActivate,
    onClose,
}: AppBarRhsPanelProps) => {
    const handleClick = useCallback(() => {
        if (panel.minimized) {
            // Minimized panel - restore it
            onRestore(panel.id);
        } else if (isActive) {
            // Active panel - minimize it (toggle off)
            onMinimize(panel.id);
        } else {
            // Non-active, non-minimized panel - activate it
            onActivate(panel.id);
        }
    }, [panel.id, panel.minimized, isActive, onRestore, onMinimize, onActivate]);

    const handleCloseClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering the panel click
        onClose(panel.id);
    }, [panel.id, onClose]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    }, [handleClick]);

    const buttonId = `app-bar-rhs-panel-${panel.id}`;
    const IconComponent = getPanelIconComponent(panel.type);
    const ariaLabel = panel.minimized ? `${panel.title} (minimized)` : panel.title;

    return (
        <WithTooltip
            title={showCloseButton ? `Close ${panel.title}` : panel.title}
            isVertical={false}
        >
            <div
                id={buttonId}
                className={classNames('app-bar__icon', {
                    'app-bar__icon--active': isActive && !panel.minimized,
                })}
                onClick={showCloseButton ? handleCloseClick : handleClick}
            >
                <span
                    role='button'
                    tabIndex={0}
                    aria-label={showCloseButton ? `Close ${ariaLabel}` : ariaLabel}
                    onKeyDown={handleKeyDown}
                    className={classNames(
                        'app-bar__icon-inner',
                        'app-bar__icon-inner--centered',
                        'app-bar__icon-inner--rhs-panel',
                        {'app-bar__icon-inner--close-mode': showCloseButton},
                    )}
                >
                    {showCloseButton ? (
                        <CloseIcon size={14}/>
                    ) : (
                        <IconComponent size={20}/>
                    )}
                </span>
            </div>
        </WithTooltip>
    );
};

export default AppBarRhsPanel;
