// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useEffect, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {LinkVariantIcon, PaperclipIcon, FileMultipleOutlineIcon} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {createWiki} from 'mattermost-redux/actions/wikis';
import {getChannelBookmarks} from 'mattermost-redux/selectors/entities/channel_bookmarks';
import {getChannel, getCurrentChannel, getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import type {getFile} from 'mattermost-redux/selectors/entities/files';
import {getCurrentRelativeTeamUrl, getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {fetchChannelBookmarks} from 'actions/channel_bookmarks';
import {fetchChannelWikis} from 'actions/pages';
import {openModal, closeModal} from 'actions/views/modals';
import {fetchWikiLinksForChannel} from 'actions/wiki_actions';
import {makeGetChannelWikis} from 'selectors/pages';

import BookmarkIcon from 'components/channel_bookmarks/bookmark_icon';
import {useBookmarkAddActions} from 'components/channel_bookmarks/channel_bookmarks_menu';
import {useChannelBookmarkPermission, useCanUploadFiles} from 'components/channel_bookmarks/utils';
import FilePreviewModal from 'components/file_preview_modal';
import LinkWikiModal from 'components/link_wiki_modal';
import * as Menu from 'components/menu';
import TextInputModal from 'components/text_input_modal';

import {Constants, ModalIdentifiers} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {getWikiUrl, shouldOpenInNewTab} from 'utils/url';

import type {GlobalState} from 'types/store';

import Tab from './channel_tab';
import WikiTabMenu from './wiki_tab_menu';
import './channel_tabs.scss';

export type TabType = string;

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
                {bookmarks.map((bookmark) => (
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
                ))}

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

const MAX_VISIBLE_WIKI_TABS = 2;

function ChannelTabs({
    activeTab,
    onTabChange,
    channelId,
}: Props) {
    const {formatMessage} = useIntl();

    const tabs = useMemo<TabConfig[]>(() => [
        {
            id: 'messages',
            label: formatMessage({id: 'channel_tabs.messages', defaultMessage: 'Messages'}),
            icon: 'icon-message-text-outline',
        },
        {
            id: 'wiki',
            label: formatMessage({id: 'channel_tabs.wiki', defaultMessage: 'Wiki'}),
            icon: 'icon-file-multiple-outline',
        },
        {
            id: 'bookmarks',
            label: formatMessage({id: 'channel_tabs.bookmarks', defaultMessage: 'Bookmarks'}),
            icon: 'icon-bookmark-outline',
        },
    ], [formatMessage]);
    const dispatch = useDispatch();
    const history = useHistory();
    const tabRefs = useRef<{[key: string]: HTMLButtonElement | null}>({});
    const bookmarksObj = useSelector((state: GlobalState) => getChannelBookmarks(state, channelId));
    const teamUrl = useSelector((state: GlobalState) => getCurrentRelativeTeamUrl(state));
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));
    const teamName = currentTeam?.name || 'team';

    // On a /wiki/ route getCurrentChannel(state) can be undefined because no channel
    // route is active. Fall back to the channel identified by the channelId prop
    // (owned by the tabs' parent) so navigating back to Messages always works.
    const channel = useSelector((state: GlobalState) => getCurrentChannel(state) || getChannel(state, channelId));
    const myMemberships = useSelector((state: GlobalState) => getMyChannelMemberships(state));

    // Get permissions and actions
    const canAdd = useChannelBookmarkPermission(channelId, 'add');
    const canUploadFiles = useCanUploadFiles();
    const {handleCreateLink, handleCreateFile} = useBookmarkAddActions(channelId);

    // Convert bookmarks object to array and sort by order
    const bookmarks = useMemo(() => {
        return Object.values(bookmarksObj).sort((a, b) => a.sort_order - b.sort_order);
    }, [bookmarksObj]);

    const getChannelWikis = useMemo(() => makeGetChannelWikis(), []);
    const wikis = useSelector((state: GlobalState) => getChannelWikis(state, channelId));
    const hasWikiPages = wikis.length > 0;

    const overflowWikis = wikis.length > MAX_VISIBLE_WIKI_TABS ? wikis.slice(MAX_VISIBLE_WIKI_TABS) : [];

    // Fetch bookmarks and wiki pages when component mounts or channel changes
    useEffect(() => {
        if (channelId) {
            dispatch(fetchChannelBookmarks(channelId));
            dispatch(fetchChannelWikis(channelId));
            dispatch(fetchWikiLinksForChannel(channelId));
        }
    }, [channelId, dispatch]);

    // Get file IDs from bookmarks
    const fileIds = useMemo(() => {
        return bookmarks.
            filter((b) => b.type === 'file' && b.file_id).
            map((b) => b.file_id!);
    }, [bookmarks]);

    // Get file info for file-type bookmarks
    const filesById = useSelector((state: GlobalState) => state.entities.files.files);
    const fileInfos = useMemo(() => {
        const files: {[key: string]: ReturnType<typeof getFile>} = {};
        fileIds.forEach((fileId) => {
            if (filesById[fileId]) {
                files[fileId] = filesById[fileId];
            }
        });
        return files;
    }, [fileIds, filesById]);

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
        dispatch(openModal({
            modalId: ModalIdentifiers.TEXT_INPUT_MODAL,
            dialogType: TextInputModal,
            dialogProps: {
                title: formatMessage({id: 'channel_tabs.create_wiki', defaultMessage: 'Create wiki'}),
                fieldLabel: formatMessage({id: 'channel_tabs.wiki_name_label', defaultMessage: 'Wiki name'}),
                confirmButtonText: formatMessage({id: 'channel_tabs.create', defaultMessage: 'Create'}),
                placeholder: formatMessage({id: 'channel_tabs.wiki_name_placeholder', defaultMessage: 'Enter wiki name'}),
                onConfirm: async (wikiName: string) => {
                    const result = await dispatch(createWiki(currentTeam?.id ?? '', channelId, wikiName.trim()));
                    dispatch(closeModal(ModalIdentifiers.TEXT_INPUT_MODAL));
                    if (result.data?.id) {
                        history.push(getWikiUrl(teamName, result.data.id));
                    }
                },
                onCancel: () => {
                    dispatch(closeModal(ModalIdentifiers.TEXT_INPUT_MODAL));
                },
            },
        }));
    }, [channelId, currentTeam?.id, dispatch, formatMessage, history, teamName]);

    const handleLinkWiki = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.WIKI_LINK,
            dialogType: LinkWikiModal,
            dialogProps: {
                channelId,
            },
        }));
    }, [channelId, dispatch]);

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
            if (tab.id === 'bookmarks') {
                return false;
            } // Bookmarks is a menu button, not navigable
            if (tab.id === 'wiki' && !hasWikiPages) {
                return false;
            } // Wiki tab hidden when no pages
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
    }, [activeTab, hasWikiPages, onTabChange]);

    const handleTabClick = useCallback((tabId: TabType) => {
        // eslint-disable-next-line no-console
        console.log('[TRACE][channel_tabs] handleTabClick', {tabId, currentUrl: window.location.pathname, teamName});
        if (tabId === 'bookmarks') {
            return;
        }

        // If it's a wiki tab, navigate to the wiki URL
        if (tabId.startsWith('wiki-')) {
            const wikiId = tabId.replace('wiki-', '');
            const targetUrl = getWikiUrl(teamName, wikiId);
            // eslint-disable-next-line no-console
            console.log('[TRACE][channel_tabs] wiki tab → history.push', {targetUrl, wikiId, teamName});
            history.push(targetUrl);
            // eslint-disable-next-line no-console
            console.log('[TRACE][channel_tabs] after history.push, url now:', window.location.pathname);
            return;
        }

        // For messages tab, navigate to the channel URL if we're currently on a wiki route.
        // Skip navigation when the user has no membership on this channel — e.g. a standalone
        // wiki with no source-channel context. Using membership (not channel type) keeps the
        // check wiki-agnostic: wiki backing channels are filtered out of GetMyChannels by the
        // server, so their absence here is the right signal without branching on server type.
        if (tabId === 'messages' && channel && myMemberships[channel.id]) {
            const currentPath = window.location.pathname;
            if (currentPath.includes('/wiki/')) {
                history.push(`${teamUrl}/channels/${channel.name}`);
                return;
            }
        }

        // For other tabs (messages), just change the tab state
        onTabChange(tabId);
    }, [onTabChange, history, teamName, teamUrl, channelId, channel, myMemberships]);

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
                        if (!hasWikiPages) {
                            return null;
                        }

                        return wikis.slice(0, MAX_VISIBLE_WIKI_TABS).map((wiki) => {
                            const wikiTabId = `wiki-${wiki.id}`;
                            const isWikiActive = activeTab === wikiTabId;

                            return (
                                <div
                                    key={wikiTabId}
                                    className='channel-tabs-container__tab-wrapper channel-tabs-container__tab-wrapper--wiki'
                                >
                                    <Tab
                                        id={wikiTabId}
                                        label={wiki.title}
                                        icon='icon-file-multiple-outline'
                                        isActive={isWikiActive}
                                        onClick={handleTabClick}
                                        onKeyDown={handleKeyDown}
                                        tabRef={(ref) => {
                                            tabRefs.current[wikiTabId] = ref;
                                        }}
                                    />
                                    <WikiTabMenu
                                        wiki={wiki}
                                        channelId={channelId}
                                    />
                                </div>
                            );
                        });
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
                {overflowWikis.length > 0 && (
                    <div className='channel-tabs-container__tab-wrapper'>
                        <Menu.Container
                            menuButton={{
                                id: 'wiki-overflow-menu',
                                'aria-label': formatMessage(
                                    {id: 'channel_tabs.wiki_overflow', defaultMessage: '+{count} more'},
                                    {count: overflowWikis.length},
                                ),
                                class: 'channel-tab',
                                children: (
                                    <div className='channel-tab__content'>
                                        <span className='channel-tab__icon'>
                                            <i className='icon-file-multiple-outline'/>
                                        </span>
                                        <span className='channel-tab__text'>
                                            <FormattedMessage
                                                id='channel_tabs.wiki_overflow'
                                                defaultMessage='+{count} more'
                                                values={{count: overflowWikis.length}}
                                            />
                                        </span>
                                        <i className='icon icon-chevron-down channel-tab__dropdown-icon'/>
                                    </div>
                                ),
                            }}
                            menu={{
                                id: 'wiki-overflow-menu-dropdown',
                            }}
                        >
                            {overflowWikis.map((wiki) => (
                                <Menu.Item
                                    key={wiki.id}
                                    leadingElement={<FileMultipleOutlineIcon size={16}/>}
                                    labels={<span>{wiki.title}</span>}
                                    onClick={() => handleTabClick(`wiki-${wiki.id}`)}
                                />
                            ))}
                        </Menu.Container>
                    </div>
                )}
            </div>

            <div className='channel-tabs-container__tab-actions'>
                {/* Show content creation options - always show menu button */}
                <Menu.Container
                    menuButton={{
                        id: 'add-tab-content',
                        'aria-label': formatMessage({id: 'channel_tabs.add_wiki', defaultMessage: 'Add wiki'}),
                        class: 'channel-tabs-container__action-button channel-tabs-container__action-button--labeled',
                        children: (
                            <>
                                <i className='icon icon-plus'/>
                                <FormattedMessage
                                    id='channel_tabs.add_wiki'
                                    defaultMessage='Add wiki'
                                />
                            </>
                        ),
                    }}
                    menuButtonTooltip={{
                        text: formatMessage({id: 'channel_tabs.add_wiki', defaultMessage: 'Add wiki'}),
                    }}
                    menu={{
                        id: 'add-tab-content-menu',
                    }}
                >
                    {[
                        <Menu.Item
                            key='wiki'
                            leadingElement={<FileMultipleOutlineIcon size={18}/>}
                            labels={
                                <FormattedMessage
                                    id='channel_tabs.wiki'
                                    defaultMessage='Wiki'
                                />
                            }
                            onClick={handleCreateWiki}
                        />,
                        <Menu.Item
                            key='link-wiki'
                            leadingElement={<LinkVariantIcon size={18}/>}
                            labels={
                                <FormattedMessage
                                    id='channel_tabs.link_wiki'
                                    defaultMessage='Link existing wiki'
                                />
                            }
                            onClick={handleLinkWiki}
                        />,
                    ]}
                </Menu.Container>
            </div>
        </div>
    );
}

export default ChannelTabs;
