// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import styled, {css} from 'styled-components';

import {
    BookOutlineIcon,
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmarkCreate} from '@mattermost/types/channel_bookmarks';

import {Client4} from 'mattermost-redux/client';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {createBookmark} from 'actions/channel_bookmarks';
import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import ChannelBookmarkCreateModal from './channel_bookmarks_create_modal';
import CreateWikiModal from './create_wiki_modal'; // [THROWAWAY CODE - PAGES EXPERIMENT]
import {MAX_BOOKMARKS_PER_CHANNEL, useChannelBookmarkPermission} from './utils';

type BookmarksMenuProps = {
    channelId: string;
    hasBookmarks: boolean;
    limitReached: boolean;
    canUploadFiles: boolean;};
function BookmarksMenu({
    channelId,
    hasBookmarks,
    limitReached,
    canUploadFiles,
}: BookmarksMenuProps) {
    const {formatMessage} = useIntl();
    const showLabel = !hasBookmarks;

    const {handleCreateLink, handleCreateFile, handleCreateWiki} = useBookmarkAddActions(channelId);
    const canAdd = useChannelBookmarkPermission(channelId, 'add');

    const addBookmarkLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'});

    const addBookmarkLimitReached = formatMessage({id: 'channel_bookmarks.addBookmarkLimitReached', defaultMessage: 'Cannot add more than {limit} bookmarks'}, {limit: MAX_BOOKMARKS_PER_CHANNEL});
    let addBookmarkTooltipText;

    if (limitReached) {
        addBookmarkTooltipText = addBookmarkLimitReached;
    } else if (hasBookmarks) {
        addBookmarkTooltipText = addBookmarkLabel;
    }

    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});
    // [THROWAWAY CODE - PAGES EXPERIMENT] Mark wiki creation with experiment emoji for easy identification
    const createWikiLabel = formatMessage({id: 'channel_bookmarks.createWiki', defaultMessage: '🧪 Create wiki (experiment)'});

    if (!canAdd) {
        return null;
    }

    return (
        <MenuButtonContainer
            withLabel={showLabel}
        >
            <Menu.Container
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                menuButton={{
                    id: 'channelBookmarksPlusMenuButton',
                    class: classNames('channelBookmarksMenuButton', {withLabel: showLabel, disabled: limitReached}),
                    children: (
                        <>
                            <PlusIcon size={showLabel ? 16 : 18}/>
                            {showLabel && <span>{addBookmarkLabel}</span>}
                        </>
                    ),
                    'aria-label': addBookmarkLabel,
                    disabled: limitReached,
                }}
                menu={{
                    id: 'channelBookmarksPlusMenuDropdown',
                }}
                menuButtonTooltip={addBookmarkTooltipText ? {
                    text: addBookmarkTooltipText,
                } : undefined}
            >
                <Menu.Item
                    key='channelBookmarksAddLink'
                    id='channelBookmarksAddLink'
                    onClick={handleCreateLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{addLinkLabel}</span>}
                />
                {canUploadFiles && (
                    <Menu.Item
                        key='channelBookmarksAttachFile'
                        id='channelBookmarksAttachFile'
                        onClick={handleCreateFile}
                        leadingElement={<PaperclipIcon size={18}/>}
                        labels={<span>{attachFileLabel}</span>}
                    />
                )}
                <Menu.Item
                    key='channelBookmarksCreateWiki'
                    id='channelBookmarksCreateWiki'
                    onClick={handleCreateWiki}
                    leadingElement={<BookOutlineIcon size={18}/>}
                    labels={<span>{createWikiLabel}</span>}
                />
            </Menu.Container>
        </MenuButtonContainer>
    );
}

export default memo(BookmarksMenu);

const MenuButtonContainer = styled.div<{withLabel: boolean}>`
    position: sticky;
    right: 0;
    ${({withLabel}) => !withLabel && css`padding: 0 1rem;`}
    background: linear-gradient(to right, rgba(var(--center-channel-bg-rgb), .16), rgba(var(--center-channel-bg-rgb), 1) 25%);
`;

export const useBookmarkAddActions = (channelId: string) => {
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);

    const handleCreate = useCallback((file?: File) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_BOOKMARK_CREATE,
            dialogType: ChannelBookmarkCreateModal,
            dialogProps: {
                channelId,
                bookmarkType: file ? 'file' : 'link',
                file,
                onConfirm: async (data: ChannelBookmarkCreate) => dispatch(createBookmark(channelId, data)),
            },
        }));
    }, [channelId, dispatch]);

    const handleCreateLink = useCallback(() => {
        handleCreate();
    }, [handleCreate]);

    const handleCreateFile = useCallback(() => {
        const input: HTMLInputElement = document.createElement('input');
        input.type = 'file';
        input.id = 'bookmark-create-file-input';
        input.hidden = true;

        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (file) {
                handleCreate(file);
            }
            input.remove();
        });
        input.addEventListener('cancel', input.remove);

        document.getElementById('root-portal')?.appendChild(input);

        input.click();
    }, [handleCreate]);

    const handleCreateWiki = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_WIKI,
            dialogType: CreateWikiModal,
            dialogProps: {
                onConfirm: async (wikiName: string) => {
                    if (!currentTeam) {
                        return;
                    }

                    try {
                        // [THROWAWAY CODE - PAGES EXPERIMENT] Create wiki with user-provided name
                        const wiki = await Client4.createWiki({
                            channel_id: channelId,
                            title: wikiName,
                        });

                        // [THROWAWAY CODE - PAGES EXPERIMENT] Auto-create bookmark for wiki with experiment marker
                        try {
                            const wikiUrl = `/${currentTeam.name}/wiki/${channelId}/${wiki.id}`;
                            await dispatch(createBookmark(channelId, {
                                display_name: wiki.title,
                                link_url: window.location.origin + wikiUrl,
                                type: 'link',
                                emoji: '🧪', // Experiment marker - makes throwaway wikis easily identifiable
                            }));
                        } catch (bookmarkError) {
                            // Continue even if bookmark creation fails
                        }

                        const targetUrl = `/${currentTeam.name}/wiki/${channelId}/${wiki.id}`;
                        history.push(targetUrl);
                    } catch (error) {
                        // Error creating wiki
                    }
                },
                onCancel: () => {
                    // Modal dismissed
                },
            },
        }));
    }, [channelId, currentTeam, history, dispatch]);

    return {handleCreateLink, handleCreateFile, handleCreateWiki};
};
