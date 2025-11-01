// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {LinkVariantIcon, PaperclipIcon, FileMultipleOutlineIcon} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';
import {getFile} from 'mattermost-redux/selectors/entities/files';

import {fetchChannelBookmarks} from 'actions/channel_bookmarks';
import {openModal} from 'actions/views/modals';

import BookmarkIcon from 'components/channel_bookmarks/bookmark_icon';
import {useBookmarkAddActions} from 'components/channel_bookmarks/channel_bookmarks_menu';
import {useChannelBookmarkPermission, useCanUploadFiles} from 'components/channel_bookmarks/utils';
import FilePreviewModal from 'components/file_preview_modal';
import * as Menu from 'components/menu';

import {Constants, ModalIdentifiers} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {shouldOpenInNewTab} from 'utils/url';

import type {GlobalState} from 'types/store';

import Tab from './channel_tab';
import './channel_tabs.scss';

export type TabType = 'messages' | 'files' | 'wiki' | 'bookmarks';

// Bookmarks tab component with hover behavior
interface BookmarksTabProps {
    tab: TabConfig;
    bookmarks: ChannelBookmark[];
    fileInfos: {[key: string]: ReturnType<typeof getFile>};
    canAdd: boolean;
    canUploadFiles: boolean;
    handleBookmarkClick: (bookmark: ChannelBookmark) => void;
    handleCreateLink: () => void;
    handleCreateFile: () => void;
}

function BookmarksTab({
    tab,
    bookmarks,
    fileInfos,
    canAdd,
    canUploadFiles,
    handleBookmarkClick,
    handleCreateLink,
    handleCreateFile,
}: BookmarksTabProps) {
    const menuId = `bookmarks-menu-${tab.id}`;

    return (
        <div className='channel-tabs-container__tab-wrapper'>
            <Menu.Container
                menuButton={{
                    id: menuId,
                    'aria-label': tab.label,
                    class: 'channel-tab',
                    children: (
                        <div className='channel-tab__content'>
                            <span className='channel-tab__icon'>
                                <i className={tab.icon}/>
                            </span>
                            <span className='channel-tab__text'>{tab.label}</span>
                            <i className='icon icon-chevron-down channel-tab__dropdown-icon'/>
                        </div>
                    ),
                }}
                menu={{
                    id: `${menuId}-menu`,
                }}
            >
                {/* Existing bookmarks */}
                {bookmarks.length > 0 ? (
                    bookmarks.map((bookmark) => (
                        <Menu.Item
                            key={bookmark.id}
                            leadingElement={
                                <BookmarkIcon
                                    type={bookmark.type}
                                    emoji={bookmark.emoji}
                                    imageUrl={bookmark.image_url}
                                    fileInfo={bookmark.file_id ? fileInfos[bookmark.file_id] : undefined}
                                    size={16}
                                />
                            }
                            labels={
                                <span>{bookmark.display_name}</span>
                            }
                            onClick={() => handleBookmarkClick(bookmark)}
                        />
                    ))
                ) : (
                    <div className='channel-bookmarks-menu__empty'>
                        <FormattedMessage
                            id='channel_tabs.bookmarks.empty'
                            defaultMessage='No bookmarks in this channel.'
                        />
                    </div>
                )}

                {/* Add options */}
                {canAdd && bookmarks.length > 0 && <Menu.Separator/>}
                {canAdd && (
                    <Menu.Item
                        leadingElement={<LinkVariantIcon size={18}/>}
                        labels={
                            <FormattedMessage
                                id='channel_bookmarks.addLink'
                                defaultMessage='Add a link'
                            />
                        }
                        onClick={handleCreateLink}
                    />
                )}
                {canAdd && canUploadFiles && (
                    <Menu.Item
                        leadingElement={<PaperclipIcon size={18}/>}
                        labels={
                            <FormattedMessage
                                id='channel_bookmarks.attachFile'
                                defaultMessage='Attach a file'
                            />
                        }
                        onClick={handleCreateFile}
                    />
                )}
            </Menu.Container>
        </div>
    );
}

interface TabConfig {
    id: TabType;
    label: string;
    icon?: string;
}

interface Props {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    channelId: string;
}

const tabs: TabConfig[] = [
    {
        id: 'messages',
        label: 'Messages',
        icon: 'icon-message-text-outline',
    },
    {
        id: 'files',
        label: 'Files',
        icon: 'icon-file-text-outline',
    },
    {
        id: 'wiki',
        label: 'Wiki',
        icon: 'icon-file-multiple-outline',
    },
    {
        id: 'bookmarks',
        label: 'Bookmarks',
        icon: 'icon-bookmark-outline',
    },
];

function ChannelTabs({
    activeTab,
    onTabChange,
    channelId,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const tabRefs = useRef<{[key: string]: HTMLButtonElement | null}>({});
    const bookmarksObj = useSelector((state: GlobalState) => getChannelBookmarks(state, channelId));

    // Get permissions and actions
    const canAdd = useChannelBookmarkPermission(channelId, 'add');
    const canUploadFiles = useCanUploadFiles();
    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(channelId);

    // Convert bookmarks object to array and sort by order
    const bookmarks = useMemo(() => {
        return Object.values(bookmarksObj).sort((a, b) => a.sort_order - b.sort_order);
    }, [bookmarksObj]);

    // TODO: Replace with proper channel-level wiki settings from database
    // LIMITATION: Currently using localStorage - only persists locally per user/device
    // Production should use channel-level settings visible to all channel members
    const [hasWikiPages, setHasWikiPages] = useState(() => {
        // Initialize from localStorage if available
        if (typeof window !== 'undefined' && channelId) {
            const stored = localStorage.getItem(`channel_wiki_${channelId}`);
            return stored === 'true';
        }
        return false;
    });

    // Fetch bookmarks and wiki state when component mounts or channel changes
    useEffect(() => {
        if (channelId) {
            dispatch(fetchChannelBookmarks(channelId));
            
            // TODO: Fetch wiki pages for this channel when wiki API is implemented
            // For now, load wiki state from localStorage for the current channel
            if (typeof window !== 'undefined') {
                const stored = localStorage.getItem(`channel_wiki_${channelId}`);
                setHasWikiPages(stored === 'true');
            }
        }
    }, [channelId, dispatch]);

    // Get file info for file-type bookmarks
    const fileInfos = useSelector((state: GlobalState) => {
        const files: {[key: string]: ReturnType<typeof getFile>} = {};
        bookmarks.forEach((bookmark) => {
            if (bookmark.type === 'file' && bookmark.file_id) {
                files[bookmark.file_id] = getFile(state, bookmark.file_id);
            }
        });
        return files;
    });

    const handleBookmarkClick = (bookmark: ChannelBookmark) => {
        if (bookmark.type === 'file' && bookmark.file_id) {
            const fileInfo = fileInfos[bookmark.file_id];
            if (fileInfo) {
                dispatch(openModal({
                    modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
                    dialogType: FilePreviewModal,
                    dialogProps: {
                        fileInfos: [fileInfo],
                        startIndex: 0,
                    },
                }));
            }
        } else if (bookmark.type === 'link' && bookmark.link_url) {
            const siteURL = window.location.origin;
            const openInNewTab = shouldOpenInNewTab(bookmark.link_url, siteURL);
            if (openInNewTab) {
                window.open(bookmark.link_url, '_blank', 'noopener,noreferrer');
            } else {
                window.location.href = bookmark.link_url;
            }
        }
    };

    const handleCreateWiki = useCallback(() => {
        // TODO: Implement actual wiki creation functionality
        // For now, simulate creating a wiki page by showing the wiki tab
        setHasWikiPages(true);
        
        // Persist wiki state to localStorage
        // TODO: Replace with proper API call to enable wiki for this channel
        // This should be a channel-level setting visible to all members
        if (typeof window !== 'undefined' && channelId) {
            localStorage.setItem(`channel_wiki_${channelId}`, 'true');
            
            // In production, this should be:
            // dispatch(enableChannelWiki(channelId));
        }
        
        // Switch to the wiki tab after creating it
        onTabChange('wiki');
        
        console.log('Wiki page created (placeholder implementation)');
    }, [onTabChange, channelId]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        let delta = 0;
        if (Keyboard.isKeyPressed(e, Constants.KeyCodes.RIGHT)) {
            delta = 1;
        } else if (Keyboard.isKeyPressed(e, Constants.KeyCodes.LEFT)) {
            delta = -1;
        }

        if (delta === 0) {
            return;
        }

        // Only navigate among actual tabs (exclude hidden/special tabs)
        const navigableTabs = tabs.filter((tab) => {
            if (tab.id === 'bookmarks') return false; // Bookmarks is a menu button, not navigable
            if (tab.id === 'wiki' && !hasWikiPages) return false; // Wiki tab hidden when no pages
            return true;
        });
        const currentIndex = navigableTabs.findIndex((tab) => tab.id === activeTab);
        let newIndex = currentIndex + delta;

        // Wrap around
        if (newIndex < 0) {
            newIndex = navigableTabs.length - 1;
        } else if (newIndex >= navigableTabs.length) {
            newIndex = 0;
        }

        const newTab = navigableTabs[newIndex];
        onTabChange(newTab.id);

        // Focus the newly active tab (ARIA tabs pattern)
        setTimeout(() => {
            const tabElement = tabRefs.current[newTab.id];
            if (tabElement) {
                tabElement.focus();
            }
        }, 0);
    }, [activeTab, onTabChange]);

    const handleTabClick = useCallback((tabId: TabType) => {
        if (tabId !== 'bookmarks') {
            onTabChange(tabId);
        }
    }, [onTabChange]);

    return (
        <div
            role='tablist'
            aria-orientation='horizontal'
            className='channel-tabs-container'
        >
            <div className='channel-tabs-container__tab-group'>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const isBookmarksTab = tab.id === 'bookmarks';
                    const isWikiTab = tab.id === 'wiki';

                    if (isBookmarksTab) {
                        // Only show bookmarks tab if there are actual bookmarks
                        if (bookmarks.length === 0) {
                            return null;
                        }

                        return (
                            <BookmarksTab
                                key={tab.id}
                                tab={tab}
                                bookmarks={bookmarks}
                                fileInfos={fileInfos}
                                canAdd={Boolean(canAdd)}
                                canUploadFiles={Boolean(canUploadFiles)}
                                handleBookmarkClick={handleBookmarkClick}
                                handleCreateLink={handleCreateLink}
                                handleCreateFile={handleCreateFile}
                            />
                        );
                    }

                    if (isWikiTab) {
                        // Only show wiki tab if there are actual wiki pages
                        if (!hasWikiPages) {
                            return null;
                        }
                    }

                    return (
                        <div
                            key={tab.id}
                            className='channel-tabs-container__tab-wrapper'
                        >
                            <Tab
                                id={tab.id}
                                label={tab.label}
                                icon={tab.icon}
                                isActive={isActive}
                                onClick={handleTabClick}
                                onKeyDown={handleKeyDown}
                                tabRef={(ref) => {
                                    tabRefs.current[tab.id] = ref;
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            <div className='channel-tabs-container__tab-actions'>
                {/* Show content creation options when wiki can be created OR bookmarks can be added */}
                {(!hasWikiPages || Boolean(canAdd)) ? (
                    <Menu.Container
                        menuButton={{
                            id: 'add-tab-content',
                            'aria-label': formatMessage({id: 'channel_tabs.add_tab_content', defaultMessage: 'Add content'}),
                            class: 'channel-tabs-container__action-button',
                            children: <i className='icon icon-plus'/>,
                        }}
                        menu={{
                            id: 'add-tab-content-menu',
                        }}
                    >
                        {/* Show wiki creation option if no wiki exists yet */}
                        {!hasWikiPages && (
                            <>
                                <Menu.Item
                                    leadingElement={<FileMultipleOutlineIcon size={18}/>}
                                    labels={
                                        <FormattedMessage
                                            id='channel_tabs.addWiki'
                                            defaultMessage='Add a wiki'
                                        />
                                    }
                                    onClick={handleCreateWiki}
                                />
                                {Boolean(canAdd) && <Menu.Separator/>}
                            </>
                        )}
                        
                        {/* Show bookmark creation options if user has permission */}
                        {Boolean(canAdd) && (
                            <>
                                <Menu.Item
                                    leadingElement={<LinkVariantIcon size={18}/>}
                                    labels={
                                        <FormattedMessage
                                            id='channel_bookmarks.addLink'
                                            defaultMessage='Add a link'
                                        />
                                    }
                                    onClick={handleCreateLink}
                                />
                                {canUploadFiles && (
                                    <Menu.Item
                                        leadingElement={<PaperclipIcon size={18}/>}
                                        labels={
                                            <FormattedMessage
                                                id='channel_bookmarks.attachFile'
                                                defaultMessage='Attach a file'
                                            />
                                        }
                                        onClick={handleCreateFile}
                                    />
                                )}
                            </>
                        )}
                    </Menu.Container>
                ) : (
                    <button
                        type='button'
                        className='channel-tabs-container__action-button'
                        title={formatMessage({id: 'channel_tabs.add_tab', defaultMessage: 'Add tab'})}
                    >
                        <i className='icon icon-plus'/>
                    </button>
                )}
            </div>
        </div>
    );
}

export default ChannelTabs;
