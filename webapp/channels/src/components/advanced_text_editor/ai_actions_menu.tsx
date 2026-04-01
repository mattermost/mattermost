// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {ChevronLeftIcon, ChevronRightIcon, CreationOutlineIcon, PencilOutlineIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

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
    rewriteMenuProps?: RewriteMenuProps;
    aiRewriteEnabled?: boolean;
}

const AIActionsMenu = ({
    draft,
    getSelectedText,
    updateText,
    channelId,
    rewriteMenuProps,
    aiRewriteEnabled,
}: AIActionsMenuProps): JSX.Element => {
    const {formatMessage} = useIntl();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

    const pluginItems = useSelector((state: GlobalState) =>
        state.plugins.components.AIActionMenuItem,
    ) as AIActionMenuItemComponent[] | undefined;

    const sortedItems = useMemo(() => {
        const items = [...(pluginItems || [])];
        items.sort((a, b) => a.sortOrder - b.sortOrder);
        return items;
    }, [pluginItems]);

    const hasItems = sortedItems.length > 0 || aiRewriteEnabled;

    const handleToggle = useCallback((open: boolean) => {
        setIsMenuOpen(open);
        if (!open) {
            setActiveSubmenu(null);
        }
        if (rewriteMenuProps) {
            rewriteMenuProps.setIsMenuOpen(open);
        }
    }, [rewriteMenuProps]);

    const handleBack = useCallback(() => {
        setActiveSubmenu(null);
    }, []);

    if (!hasItems) {
        return <></>;
    }

    // Render submenu content inline when a submenu is active
    const renderActiveSubmenu = () => {
        if (!activeSubmenu) {
            return null;
        }

        // Check if it's the rewrite submenu
        if (activeSubmenu === '__rewrite__' && rewriteMenuProps) {
            return (
                <>
                    <Menu.Item
                        id='ai-action-back-rewrite'
                        role='menuitemradio'
                        leadingElement={<ChevronLeftIcon size={18}/>}
                        labels={(
                            <FormattedMessage
                                id='texteditor.rewrite'
                                defaultMessage='Rewrite'
                            />
                        )}
                        onClick={handleBack}
                    />
                    <Menu.Separator/>
                    <RewriteSubMenuHeader
                        isProcessing={rewriteMenuProps.isProcessing}
                        draftMessage={rewriteMenuProps.draftMessage}
                        prompt={rewriteMenuProps.prompt}
                        setPrompt={rewriteMenuProps.setPrompt}
                        selectedAgentId={rewriteMenuProps.selectedAgentId}
                        setSelectedAgentId={rewriteMenuProps.setSelectedAgentId}
                        agents={rewriteMenuProps.agents}
                        onCustomPromptKeyDown={rewriteMenuProps.onCustomPromptKeyDown}
                        onCancelProcessing={rewriteMenuProps.onCancelProcessing}
                        customPromptRef={rewriteMenuProps.customPromptRef}
                    />
                    <RewriteSubmenu
                        draftMessage={rewriteMenuProps.draftMessage}
                        onMenuAction={rewriteMenuProps.onMenuAction}
                    />
                    <RewriteSubMenuFooter
                        isProcessing={rewriteMenuProps.isProcessing}
                        originalMessage={rewriteMenuProps.originalMessage}
                        lastAction={rewriteMenuProps.lastAction}
                        onUndoMessage={rewriteMenuProps.onUndoMessage}
                        onRegenerateMessage={rewriteMenuProps.onRegenerateMessage}
                    />
                </>
            );
        }

        // Check plugin submenus
        const pluginItem = sortedItems.find((item) => item.id === activeSubmenu);
        if (pluginItem) {
            const PluginComponent = pluginItem.component;
            const SubMenuHeader = pluginItem.subMenuHeader;
            return (
                <>
                    <Menu.Item
                        id={`ai-action-back-${pluginItem.id}`}
                        role='menuitemradio'
                        leadingElement={<ChevronLeftIcon size={18}/>}
                        labels={<span>{pluginItem.text}</span>}
                        onClick={handleBack}
                    />
                    <Menu.Separator/>
                    {SubMenuHeader && (
                        <SubMenuHeader
                            draft={draft}
                            getSelectedText={getSelectedText}
                            updateText={updateText}
                            channelId={channelId}
                        />
                    )}
                    <PluginComponent
                        draft={draft}
                        getSelectedText={getSelectedText}
                        updateText={updateText}
                        channelId={channelId}
                    />
                </>
            );
        }

        return null;
    };

    return (
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
            {activeSubmenu ? renderActiveSubmenu() : (
                <>
                    {sortedItems.map((item) => (
                        <Menu.Item
                            key={item.id}
                            id={`ai-action-${item.id}`}
                            role='menuitemradio'
                            leadingElement={item.icon}
                            labels={<span>{item.text}</span>}
                            trailingElements={<ChevronRightIcon size={18}/>}
                            onClick={() => setActiveSubmenu(item.id)}
                        />
                    ))}
                    {aiRewriteEnabled && rewriteMenuProps && sortedItems.length > 0 && (
                        <Menu.Separator/>
                    )}
                    {aiRewriteEnabled && rewriteMenuProps && (
                        <Menu.Item
                            id='ai-action-rewrite'
                            role='menuitemradio'
                            leadingElement={<PencilOutlineIcon size={18}/>}
                            labels={(
                                <FormattedMessage
                                    id='texteditor.rewrite'
                                    defaultMessage='Rewrite'
                                />
                            )}
                            trailingElements={<ChevronRightIcon size={18}/>}
                            onClick={() => setActiveSubmenu('__rewrite__')}
                        />
                    )}
                </>
            )}
        </Menu.Container>
    );
};

export default AIActionsMenu;
