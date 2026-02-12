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
import {useIntl} from 'react-intl';

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

import ThreadPanelTooltip from './thread_panel_tooltip';

type AppBarRhsPanelProps = {
    panel: RhsPanelState;
    isActive: boolean;
    showCloseButton: boolean;
    onRestore: (panelId: string) => void;
    onMinimize: (panelId: string) => void;
    onActivate: (panelId: string) => void;
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
    const {formatMessage} = useIntl();

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

    let ariaLabel = panel.title;
    if (panel.minimized) {
        ariaLabel = formatMessage({id: 'app_bar.rhs_panel.minimized', defaultMessage: '{title} (minimized)'}, {title: panel.title});
    }
    if (showCloseButton) {
        ariaLabel = formatMessage({id: 'app_bar.rhs_panel.close', defaultMessage: 'Close {title}'}, {title: panel.title});
    }

    // Get tooltip content based on panel type
    const getTooltipTitle = (): string | React.ReactNode => {
        if (showCloseButton) {
            return formatMessage(
                {id: 'app_bar.rhs_panel.close', defaultMessage: 'Close {title}'},
                {title: panel.title},
            );
        }

        // Thread panels get a rich tooltip with author, avatars, reply count, and preview
        if (panel.type === 'thread' && panel.selectedPostId) {
            return <ThreadPanelTooltip postId={panel.selectedPostId}/>;
        }

        // Search panels show the search terms
        if (panel.type === 'search' && panel.searchTerms) {
            return formatMessage(
                {id: 'app_bar.rhs_panel.search', defaultMessage: 'Search: {terms}'},
                {terms: panel.searchTerms},
            );
        }

        return panel.title;
    };

    return (
        <WithTooltip
            title={getTooltipTitle()}
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
                    aria-label={ariaLabel}
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
