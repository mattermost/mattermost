// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {JSX, KeyboardEvent, MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ChevronRightIcon, CreationOutlineIcon, PencilOutlineIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {PopoverMenu} from '@mattermost/compass-ui/components/popover-menu';

import {closeModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import {compassSurfaceOriginClass, useCompassMenuPresence, useSubmenuSide} from 'components/menu/compass_menu_motion';
import {MenuContext} from 'components/menu/menu_context';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';
import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';
import type {AIActionMenuItemComponent} from 'types/store/plugins';

import {COMPOSER_PLUS_MENU_ID, submenuPointerDestination, useComposerSubmenuHover, useDelayedSubmenuClose} from './composer_submenu_hover';
import type {RewriteMenuProps} from './rewrite_menu';

const AIActionsMenuTrigger = Menu.createMenuIconButtonTrigger({size: 'small'});

interface AIActionsMenuProps {
    draft: PostDraft;
    getSelectedText: () => {start: number; end: number};
    updateText: (message: string) => void;
    channelId: string;
    isRHS: boolean;
    rewriteMenuProps?: RewriteMenuProps;
    aiRewriteEnabled?: boolean;

    // Render the rows inside the composer + menu instead of a separate button.
    embedded?: boolean;
    parentOpen?: boolean;
}

const AIActionsMenu = ({
    draft,
    getSelectedText,
    updateText,
    channelId,
    isRHS,
    rewriteMenuProps,
    aiRewriteEnabled,
    embedded = false,
    parentOpen = false,
}: AIActionsMenuProps): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const parentMenu = useContext(MenuContext);
    const submenuMenuContext = useMemo(() => ({
        ...parentMenu,
        compass: true,
    }), [parentMenu]);
    const {activeRow, claimRow} = useComposerSubmenuHover();
    const panelRef = useRef<HTMLDivElement>(null);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
    const [submenuAnchorEl, setSubmenuAnchorEl] = useState<HTMLElement | null>(null);

    const pluginItems = useSelector((state: GlobalState) =>
        state.plugins.components.AIActionMenuItem,
    ) as AIActionMenuItemComponent[] | undefined;

    const sortedItems = useMemo(() => {
        const items = [...(pluginItems || [])];
        items.sort((a, b) => a.sortOrder - b.sortOrder);
        return items;
    }, [pluginItems]);

    const hasItems = sortedItems.length > 0 || (aiRewriteEnabled && Boolean(rewriteMenuProps));

    const closeSubmenu = useCallback(() => {
        setActiveSubmenu(null);
        setSubmenuAnchorEl(null);
    }, []);
    const {cancel: cancelClose, schedule: scheduleClose} = useDelayedSubmenuClose(closeSubmenu);

    const handleToggle = useCallback((open: boolean) => {
        setIsMenuOpen(open);
        if (!open) {
            cancelClose();
            closeSubmenu();
        }
    }, [cancelClose, closeSubmenu]);

    useEffect(() => {
        if (!embedded) {
            return;
        }
        if (!parentOpen || (activeSubmenu && activeRow !== activeSubmenu)) {
            cancelClose();
            closeSubmenu();
        }
    }, [activeRow, activeSubmenu, cancelClose, closeSubmenu, embedded, parentOpen]);

    const closeUnlessInside = useCallback((next: EventTarget | null, anchor: HTMLElement | null) => {
        const destination = submenuPointerDestination(next, panelRef.current, anchor);
        if (destination === 'stay') {
            cancelClose();
            return;
        }
        if (destination === 'close') {
            cancelClose();
            closeSubmenu();
            return;
        }
        scheduleClose();
    }, [cancelClose, closeSubmenu, scheduleClose]);

    const handleItemHover = useCallback((submenuId: string) => {
        return (event: MouseEvent<HTMLLIElement>) => {
            cancelClose();
            claimRow(submenuId);
            setActiveSubmenu(submenuId);
            setSubmenuAnchorEl(event.currentTarget);
        };
    }, [cancelClose, claimRow]);

    const handleItemLeave = useCallback((event: MouseEvent<HTMLLIElement>) => {
        closeUnlessInside(event.relatedTarget, event.currentTarget);
    }, [closeUnlessInside]);

    const handlePanelLeave = useCallback((event: MouseEvent<HTMLDivElement>) => {
        closeUnlessInside(event.relatedTarget, submenuAnchorEl);
    }, [closeUnlessInside, submenuAnchorEl]);

    // The panel is inside the parent menu. Arrow keys belong to the panel, not
    // the parent list's item traversal.
    const stopSubmenuArrows = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (
            isKeyPressed(event, Constants.KeyCodes.UP) ||
            isKeyPressed(event, Constants.KeyCodes.DOWN) ||
            isKeyPressed(event, Constants.KeyCodes.LEFT) ||
            isKeyPressed(event, Constants.KeyCodes.RIGHT)
        ) {
            event.stopPropagation();
        }
    }, []);

    const handlePlainHover = useCallback((rowId: string) => {
        return () => {
            cancelClose();
            claimRow(rowId);
            closeSubmenu();
        };
    }, [cancelClose, claimRow, closeSubmenu]);

    const handleItemKeyDown = useCallback((submenuId: string) => {
        return (event: KeyboardEvent<HTMLLIElement>) => {
            if (
                isKeyPressed(event, Constants.KeyCodes.ENTER) ||
                isKeyPressed(event, Constants.KeyCodes.SPACE) ||
                isKeyPressed(event, Constants.KeyCodes.RIGHT)
            ) {
                event.preventDefault();
                cancelClose();
                claimRow(submenuId);
                setActiveSubmenu(submenuId);
                setSubmenuAnchorEl(event.currentTarget);
            }
        };
    }, [cancelClose, claimRow]);

    const openRewrite = useCallback(() => {
        if (!rewriteMenuProps) {
            return;
        }
        const anchor = document.querySelector<HTMLElement>('#agentComposerMenuButton[aria-expanded="true"]') ??
            document.querySelector<HTMLElement>('#ai-actions-button[aria-expanded="true"]') ??
            document.getElementById('agentComposerMenuButton') ??
            document.getElementById('ai-actions-button');
        const open = () => rewriteMenuProps.openMenu(anchor);
        if (parentMenu.close) {
            parentMenu.addOnClosedListener(open);
            parentMenu.close();
            return;
        }
        dispatch(closeModal(embedded ? COMPOSER_PLUS_MENU_ID : 'ai-actions-menu'));
        open();
    }, [dispatch, embedded, parentMenu, rewriteMenuProps]);

    const handleActionClick = useCallback((action: NonNullable<AIActionMenuItemComponent['action']>) => {
        return () => {
            action({draft, getSelectedText, updateText, channelId, isRHS});
            handleToggle(false);
        };
    }, [draft, getSelectedText, updateText, channelId, isRHS, handleToggle]);

    const displayedSubmenuRef = useRef<string | null>(null);
    if (activeSubmenu) {
        displayedSubmenuRef.current = activeSubmenu;
    }

    const menuIsOpen = embedded ? parentOpen : isMenuOpen;
    const submenuOpen = Boolean(activeSubmenu) && menuIsOpen;
    const {present: submenuPresent, onExited: submenuExited} = useCompassMenuPresence(submenuOpen);
    const submenuSide = useSubmenuSide(submenuOpen, activeSubmenu, submenuAnchorEl);
    const setAnchorNode = useCallback((node: HTMLDivElement | null) => {
        panelRef.current = node;
        submenuSide.anchorRef.current = node;
    }, [submenuSide.anchorRef]);

    if (!hasItems) {
        return null;
    }

    const panelSubmenu = activeSubmenu ?? displayedSubmenuRef.current;

    const rows = (
        <>
            {sortedItems.map((item) => {
                if (item.component) {
                    const PluginComponent = item.component;
                    const showSubmenu = submenuPresent && panelSubmenu === item.id;
                    return (
                        <Menu.Item
                            key={item.id}
                            id={`ai-action-${item.id}`}
                            role='menuitem'
                            aria-haspopup='menu'
                            aria-expanded={activeSubmenu === item.id}
                            leadingElement={item.icon}
                            labels={<span>{item.text}</span>}
                            trailingElements={<ChevronRightIcon size={18}/>}
                            onMouseEnter={handleItemHover(item.id)}
                            onMouseLeave={handleItemLeave}
                            onKeyDown={handleItemKeyDown(item.id)}
                        >
                            {showSubmenu && (
                                <div
                                    className='menu_submenuAnchor'
                                    data-x={submenuSide.side.x}
                                    data-y={submenuSide.side.y}
                                    role='presentation'
                                    ref={setAnchorNode}
                                    onMouseEnter={cancelClose}
                                    onMouseLeave={handlePanelLeave}
                                    onKeyDown={stopSubmenuArrows}
                                >
                                    <MenuContext.Provider value={submenuMenuContext}>
                                        <PopoverMenu
                                            variant='child'
                                            open={submenuOpen}
                                            onExited={submenuExited}
                                            className={classNames('menu_menuStyled__surface', compassSurfaceOriginClass(submenuSide.transformOrigin))}
                                        >
                                            <PluggableErrorBoundary pluginId={item.pluginId}>
                                                <PluginComponent
                                                    draft={draft}
                                                    getSelectedText={getSelectedText}
                                                    updateText={updateText}
                                                    channelId={channelId}
                                                    isRHS={isRHS}
                                                />
                                            </PluggableErrorBoundary>
                                        </PopoverMenu>
                                    </MenuContext.Provider>
                                </div>
                            )}
                        </Menu.Item>
                    );
                }
                if (item.action) {
                    return (
                        <Menu.Item
                            key={item.id}
                            id={`ai-action-${item.id}`}
                            role='menuitem'
                            leadingElement={item.icon}
                            labels={<span>{item.text}</span>}
                            onMouseEnter={handlePlainHover(item.id)}
                            onClick={handleActionClick(item.action)}
                        />
                    );
                }
                return null;
            })}
            {aiRewriteEnabled && rewriteMenuProps && sortedItems.length > 0 && (
                <Menu.Separator/>
            )}
            {aiRewriteEnabled && rewriteMenuProps && (
                <Menu.Item
                    id='ai-action-rewrite'
                    role='menuitem'
                    leadingElement={<PencilOutlineIcon size={18}/>}
                    labels={(
                        <FormattedMessage
                            id='texteditor.rewrite'
                            defaultMessage='Rewrite'
                        />
                    )}
                    disableCloseOnSelect={true}
                    onMouseEnter={handlePlainHover('rewrite')}
                    onClick={openRewrite}
                />
            )}
        </>
    );

    if (embedded) {
        return rows;
    }

    return (
        <>
            <Menu.Container
                menuButton={{
                    id: 'ai-actions-button',
                    as: AIActionsMenuTrigger,
                    class: 'control',
                    'aria-label': formatMessage({
                        id: 'texteditor.ai_actions',
                        defaultMessage: 'AI Actions',
                    }),
                    children: <Icon glyph={<CreationOutlineIcon/>}/>,
                }}
                menuButtonTooltip={{
                    text: formatMessage({
                        id: 'texteditor.ai_actions',
                        defaultMessage: 'AI Actions',
                    }),
                }}
                menu={{
                    id: 'ai-actions-menu',
                    'aria-label': formatMessage({
                        id: 'texteditor.ai_actions.menu',
                        defaultMessage: 'AI Actions',
                    }),
                    className: 'ai-actions-menu',
                    onToggle: handleToggle,
                    isMenuOpen,
                    compass: true,
                }}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                {rows}
            </Menu.Container>
        </>
    );
};

export default AIActionsMenu;
