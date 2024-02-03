// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

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

import type {ActionResult} from 'mattermost-redux/types/actions';
import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {editBookmark, deleteBookmark} from 'actions/channel_bookmarks';
import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import {getSiteURL, shouldOpenInNewTab} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import BookmarkDeleteModal from './bookmark_delete_modal';
import ChannelBookmarksCreateModal from './channel_bookmarks_create_modal';
import {useChannelBookmarkPermission} from './utils';

type Props = {bookmark: ChannelBookmark; open: () => void};
const BookmarkItemDotMenu = ({
    bookmark,
    open,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

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

    const editLabel = formatMessage({id: 'channel_bookmarks.edit', defaultMessage: 'Edit'});
    const openLabel = formatMessage({id: 'channel_bookmarks.open', defaultMessage: 'Open'});
    const copyLabel = formatMessage({id: 'channel_bookmarks.copy', defaultMessage: 'Copy link'});
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
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_BOOKMARK_DELETE,
            dialogType: BookmarkDeleteModal,
            dialogProps: {
                displayName: bookmark.display_name,
                onConfirm: () => dispatch(deleteBookmark(bookmark.channel_id, bookmark.id)),
            },
        }));
    }, [deleteBookmark, dispatch]);

    return (
        <Menu.Container
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
            menuButton={{
                id: 'channelBookmarksDotMenuButton',
                children: <DotsHorizontalIcon size={18}/>,
                'aria-label': formatMessage({id: 'channel_bookmarks.addBookmarkLabel', defaultMessage: 'Add a bookmark'}),
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
            <Menu.Item
                key='channelBookmarksCopy'
                id='channelBookmarksCopy'
                onClick={copyLink}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={<span>{copyLabel}</span>}
                aria-label={copyLabel}
            />
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
