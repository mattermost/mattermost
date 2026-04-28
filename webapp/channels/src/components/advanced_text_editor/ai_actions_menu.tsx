// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MuiMenuList from '@mui/material/MenuList';
import MuiPopover from '@mui/material/Popover';
import type {PopoverOrigin} from '@mui/material/Popover';
import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
import type {KeyboardEvent, MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {ChevronRightIcon, CreationOutlineIcon, PencilOutlineIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';
import type {AIActionMenuItemComponent} from 'types/store/plugins';

import {IconContainer} from './formatting_bar/formatting_icon';
import type {RewriteMenuProps} from './rewrite_menu';
import {RewriteSubmenu, RewriteSubMenuHeader, RewriteSubMenuFooter} from './rewrite_menu';

interface AIActionsMenuProps {
    draft: PostDraft;
    getSelectedText: () => {start: number; end: number};
    updateText: (message: string) => void;
    channelId: string;
    isRHS: boolean;
    rewriteMenuProps?: RewriteMenuProps;
    aiRewriteEnabled?: boolean;
}

const AIActionsMenu = ({
    draft,
    getSelectedText,
    updateText,
    channelId,
    isRHS,
    rewriteMenuProps,
    aiRewriteEnabled,
}: AIActionsMenuProps): JSX.Element => {
    const {formatMessage} = useIntl();

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

    const handleToggle = useCallback((open: boolean) => {
        setIsMenuOpen(open);
        if (!open) {
            setActiveSubmenu(null);
            setSubmenuAnchorEl(null);
        }
        if (rewriteMenuProps) {
            rewriteMenuProps.setIsMenuOpen(open);
        }
    }, [rewriteMenuProps]);

    const handleItemHover = useCallback((submenuId: string) => {
        return (event: MouseEvent<HTMLLIElement>) => {
            setActiveSubmenu(submenuId);
            setSubmenuAnchorEl(event.currentTarget);
        };
    }, []);

    const handleItemKeyDown = useCallback((submenuId: string) => {
        return (event: KeyboardEvent<HTMLLIElement>) => {
            if (
                isKeyPressed(event, Constants.KeyCodes.ENTER) ||
                isKeyPressed(event, Constants.KeyCodes.SPACE) ||
                isKeyPressed(event, Constants.KeyCodes.RIGHT)
            ) {
                event.preventDefault();
                setActiveSubmenu(submenuId);
                setSubmenuAnchorEl(event.currentTarget);
            }
        };
    }, []);

    const handleActionClick = useCallback((action: NonNullable<AIActionMenuItemComponent['action']>) => {
        return () => {
            action({draft, getSelectedText, updateText, channelId, isRHS});
            handleToggle(false);
        };
    }, [draft, getSelectedText, updateText, channelId, isRHS, handleToggle]);

    const submenuOrigins = useMemo((): {anchorOrigin: PopoverOrigin; transformOrigin: PopoverOrigin} => {
        const MIN_SUBMENU_WIDTH = 400;
        if (submenuAnchorEl) {
            const rightSpace = window.innerWidth - (submenuAnchorEl.getBoundingClientRect()?.right ?? 0);
            if (rightSpace < MIN_SUBMENU_WIDTH) {
                return {
                    anchorOrigin: {vertical: 'bottom', horizontal: 'left'},
                    transformOrigin: {vertical: 'bottom', horizontal: 'right'},
                };
            }
        }
        return {
            anchorOrigin: {vertical: 'bottom', horizontal: 'right'},
            transformOrigin: {vertical: 'bottom', horizontal: 'left'},
        };
    }, [submenuAnchorEl]);

    if (!hasItems) {
        return <></>;
    }

    const isRewriteSubmenu = activeSubmenu === '__rewrite__';
    const activePluginItem = activeSubmenu && !isRewriteSubmenu ? sortedItems.find((item) => item.id === activeSubmenu && item.component) : null;
    const hasActiveSubmenu = Boolean(activeSubmenu) && (isRewriteSubmenu || Boolean(activePluginItem));

    const submenuClassName = classNames(
        'menu_menuStyled',
        'AsSubMenu',
        'ai-actions-submenu',
        {
            'ai-actions-submenu-rewrite': isRewriteSubmenu,
        },
    );

    return (
        <>
            <Menu.Container
                menuButton={{
                    id: 'ai-actions-button',
                    as: 'div',
                    children: (
                        <IconContainer
                            id='aiActionsMenu'
                            className={classNames('control', {active: isMenuOpen})}
                            type='button'
                            aria-label={formatMessage({
                                id: 'texteditor.ai_actions',
                                defaultMessage: 'AI Actions',
                            })}
                        >
                            <CreationOutlineIcon
                                size={18}
                                color='currentColor'
                            />
                        </IconContainer>
                    ),
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
                {sortedItems.map((item) => {
                    if (item.component) {
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
                                onKeyDown={handleItemKeyDown(item.id)}
                            />
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
                        aria-haspopup='menu'
                        aria-expanded={activeSubmenu === '__rewrite__'}
                        leadingElement={<PencilOutlineIcon size={18}/>}
                        labels={(
                            <FormattedMessage
                                id='texteditor.rewrite'
                                defaultMessage='Rewrite'
                            />
                        )}
                        trailingElements={<ChevronRightIcon size={18}/>}
                        onMouseEnter={handleItemHover('__rewrite__')}
                        onKeyDown={handleItemKeyDown('__rewrite__')}
                    />
                )}
            </Menu.Container>

            {/* Cascading submenu popover — anchored to the hovered menu item */}
            {hasActiveSubmenu && isMenuOpen && (
                <MuiPopover
                    open={true}
                    anchorEl={submenuAnchorEl}
                    anchorOrigin={submenuOrigins.anchorOrigin}
                    transformOrigin={submenuOrigins.transformOrigin}
                    className={submenuClassName}
                    disableAutoFocus={true}
                    disableEnforceFocus={true}
                    disableRestoreFocus={true}
                    hideBackdrop={true}
                >
                    {/* pointer-events wrapper: AsSubMenu disables pointer-events on the popover root,
                        so we re-enable on the content div to make everything inside clickable */}
                    <div style={{pointerEvents: 'auto'}}>
                        {isRewriteSubmenu && rewriteMenuProps && (
                            <>
                                <RewriteSubMenuHeader
                                    isProcessing={rewriteMenuProps.isProcessing}
                                    draftMessage={rewriteMenuProps.draftMessage}
                                    originalMessage={rewriteMenuProps.originalMessage}
                                    prompt={rewriteMenuProps.prompt}
                                    setPrompt={rewriteMenuProps.setPrompt}
                                    selectedAgentId={rewriteMenuProps.selectedAgentId}
                                    setSelectedAgentId={rewriteMenuProps.setSelectedAgentId}
                                    agents={rewriteMenuProps.agents}
                                    onCustomPromptKeyDown={rewriteMenuProps.onCustomPromptKeyDown}
                                    onCancelProcessing={rewriteMenuProps.onCancelProcessing}
                                    customPromptRef={rewriteMenuProps.customPromptRef}
                                />
                                <MuiMenuList
                                    sx={{py: 0}}
                                >
                                    <RewriteSubmenu
                                        isProcessing={rewriteMenuProps.isProcessing}
                                        draftMessage={rewriteMenuProps.draftMessage}
                                        onMenuAction={rewriteMenuProps.onMenuAction}
                                    />
                                </MuiMenuList>
                                <RewriteSubMenuFooter
                                    isProcessing={rewriteMenuProps.isProcessing}
                                    originalMessage={rewriteMenuProps.originalMessage}
                                    lastAction={rewriteMenuProps.lastAction}
                                    onUndoMessage={rewriteMenuProps.onUndoMessage}
                                    onRegenerateMessage={rewriteMenuProps.onRegenerateMessage}
                                />
                            </>
                        )}
                        {activePluginItem?.component && (() => {
                            const PluginComponent = activePluginItem.component;
                            return (
                                <PluginComponent
                                    draft={draft}
                                    getSelectedText={getSelectedText}
                                    updateText={updateText}
                                    channelId={channelId}
                                    isRHS={isRHS}
                                />
                            );
                        })()}
                    </div>
                </MuiPopover>
            )}
        </>
    );
};

export default AIActionsMenu;
