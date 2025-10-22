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
    const createWikiLabel = formatMessage({id: 'channel_bookmarks.createWiki', defaultMessage: 'Create wiki'});

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

    const handleCreateWiki = useCallback(async () => {
        if (!currentTeam) {
            console.error('[CreateWiki] No current team found');
            return;
        }

        try {
            console.log('[CreateWiki] Creating wiki for channel', channelId);
            const wiki = await Client4.createWiki({
                channel_id: channelId,
                title: 'Untitled Wiki',
            });
            console.log('[CreateWiki] Wiki created successfully (with default draft):', wiki);

            const targetUrl = `/${currentTeam.name}/wiki/${channelId}/${wiki.id}`;
            console.log('[CreateWiki] Navigating to:', targetUrl);
            console.log('[CreateWiki] Current location before push:', window.location.pathname);
            history.push(targetUrl);
            console.log('[CreateWiki] Navigation pushed, location should change');
        } catch (error) {
            console.error('[CreateWiki] Failed to create wiki:', error);
        }
    }, [channelId, currentTeam, history]);

    return {handleCreateLink, handleCreateFile, handleCreateWiki};
};
