// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {
    DotsHorizontalIcon,
    PencilOutlineIcon,
    LinkVariantIcon,
    TrashCanOutlineIcon,
    ArrowExpandIcon,
    OpenInNewIcon,
    BookOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmark, ChannelBookmarkPatch} from '@mattermost/types/channel_bookmarks';

import {Client4} from 'mattermost-redux/client';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {editBookmark, deleteBookmark} from 'actions/channel_bookmarks';
import {openModal} from 'actions/views/modals';

import GetPublicModal from 'components/get_public_link_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import {getSiteURL, shouldOpenInNewTab} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import BookmarkDeleteModal from './bookmark_delete_modal';
import ChannelBookmarksCreateModal from './channel_bookmarks_create_modal';
import {useCanGetPublicLink, useChannelBookmarkPermission} from './utils';

type Props = {bookmark: ChannelBookmark; open: () => void};
const BookmarkItemDotMenu = ({
    bookmark,
    open,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);

    const siteURL = getSiteURL();
    const openInNewTab = bookmark.type === 'link' && bookmark.link_url && shouldOpenInNewTab(bookmark.link_url, siteURL);

    let openIcon;
    if (bookmark.type === 'file') {
        openIcon = <ArrowExpandIcon size={18}/>;
    } else if (bookmark.link_url) {
        openIcon = openInNewTab ? <OpenInNewIcon size={18}/> : <BookOutlineIcon size={18}/>;
    }

    const canEdit = useChannelBookmarkPermission(bookmark.channel_id, 'edit');
    const canDelete = useChannelBookmarkPermission(bookmark.channel_id, 'delete');
    const canGetPublicLink = useCanGetPublicLink();

    const editLabel = formatMessage({id: 'channel_bookmarks.edit', defaultMessage: 'Edit'});
    const openLabel = formatMessage({id: 'channel_bookmarks.open', defaultMessage: 'Open'});
    const copyLinkLabel = formatMessage({id: 'channel_bookmarks.copy', defaultMessage: 'Copy link'});
    const copyFileLabel = formatMessage({id: 'channel_bookmarks.copyFilePublicLink', defaultMessage: 'Get a public link'});
    const deleteLabel = formatMessage({id: 'channel_bookmarks.delete', defaultMessage: 'Delete'});

    const handleEdit = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_BOOKMARK_CREATE,
            dialogType: ChannelBookmarksCreateModal,
            dialogProps: {
                bookmark,
                channelId: bookmark.channel_id,
                onConfirm: async (data: ChannelBookmarkPatch) => dispatch(editBookmark(bookmark.channel_id, bookmark.id, data)) as ActionResult<boolean>,
            },
        }));
    }, [editBookmark, dispatch, bookmark]);

    const copyLink = useCallback(() => {
        if (bookmark.type === 'link' && bookmark.link_url) {
            copyToClipboard(bookmark.link_url);
        } else if (bookmark.type === 'file' && bookmark.file_id) {
            copyToClipboard(getFileDownloadUrl(bookmark.file_id));
        }
    }, [bookmark.type, bookmark.link_url, bookmark.file_id]);

    const handleDelete = useCallback(() => {
        // [THROWAWAY CODE - PAGES EXPERIMENT] Check if this is a wiki bookmark (has 🧪 emoji)
        const isWikiBookmark = bookmark.emoji === '🧪';

        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_BOOKMARK_DELETE,
            dialogType: BookmarkDeleteModal,
            dialogProps: {
                displayName: bookmark.display_name,
                onConfirm: async () => {
                    // [THROWAWAY CODE - PAGES EXPERIMENT] If this is a wiki bookmark, delete the wiki first
                    if (isWikiBookmark && bookmark.link_url) {
                        try {
                            // Extract wikiId from URL like: /team/wiki/channelId/wikiId
                            const urlMatch = bookmark.link_url.match(/\/wiki\/[^/]+\/([^/?]+)/);
                            if (urlMatch && urlMatch[1]) {
                                const wikiId = urlMatch[1];
                                await Client4.deleteWiki(wikiId);
                            }
                        } catch (error) {
                            console.error('[BOOKMARK DELETE] Failed to delete wiki:', error);
                            // Continue to delete bookmark even if wiki deletion fails
                        }
                    }

                    // Delete the bookmark
                    const result = await dispatch(deleteBookmark(bookmark.channel_id, bookmark.id));

                    // [THROWAWAY CODE - PAGES EXPERIMENT] Navigate to channel after deleting wiki bookmark
                    if (isWikiBookmark && currentTeam) {
                        const channelUrl = `/${currentTeam.name}/channels/${bookmark.channel_id}`;
                        history.push(channelUrl);
                    }

                    return result;
                },
            },
        }));
    }, [deleteBookmark, dispatch, bookmark, currentTeam, history]);

    const handleGetPublicLink = useCallback(() => {
        if (!bookmark.file_id) {
            return;
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.GET_PUBLIC_LINK_MODAL,
            dialogType: GetPublicModal,
            dialogProps: {
                fileId: bookmark.file_id,
            },
        }));
    }, [bookmark.file_id, dispatch]);

    return (
        <Menu.Container
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
            menuButton={{
                id: `channelBookmarksDotMenuButton-${bookmark.id}`,
                class: 'channelBookmarksDotMenuButton',
                children: <DotsHorizontalIcon size={18}/>,
                'aria-label': formatMessage({id: 'channel_bookmarks.editBookmarkLabel', defaultMessage: 'Bookmark menu'}),
            }}
            menu={{
                id: 'channelBookmarksDotMenuDropdown',
            }}
        >
            <Menu.Item
                key='channelBookmarksOpen'
                id='channelBookmarksOpen'
                onClick={open}
                leadingElement={openIcon}
                labels={<span>{openLabel}</span>}
                aria-label={openLabel}
            />
            {canEdit && (
                <Menu.Item
                    key='channelBookmarksEdit'
                    id='channelBookmarksEdit'
                    onClick={handleEdit}
                    leadingElement={<PencilOutlineIcon size={18}/>}
                    labels={<span>{editLabel}</span>}
                    aria-label={editLabel}
                />
            )}
            {bookmark.type === 'link' && (
                <Menu.Item
                    key='channelBookmarksLinkCopy'
                    id='channelBookmarksLinkCopy'
                    onClick={copyLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{copyLinkLabel}</span>}
                    aria-label={copyLinkLabel}
                />
            )}
            {bookmark.type === 'file' && canGetPublicLink && (
                <Menu.Item
                    key='channelBookmarksFileCopy'
                    id='channelBookmarksFileCopy'
                    onClick={handleGetPublicLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{copyFileLabel}</span>}
                    aria-label={copyFileLabel}
                />
            )}
            {canDelete && (
                <Menu.Item
                    key='channelBookmarksDelete'
                    id='channelBookmarksDelete'
                    onClick={handleDelete}
                    leadingElement={<TrashCanOutlineIcon size={18}/>}
                    labels={<span>{deleteLabel}</span>}
                    aria-label={deleteLabel}
                    isDestructive={true}
                />
            )}
        </Menu.Container>
    );
};

export default BookmarkItemDotMenu;
