// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
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

import GetPublicModal from 'components/get_public_link_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import {getSiteURL, shouldOpenInNewTab} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import BookmarkDeleteModal from './bookmark_delete_modal';
import ChannelBookmarksCreateModal from './channel_bookmarks_create_modal';
import {useCanGetPublicLink, useChannelBookmarkPermission} from './utils';

type Props = {
    bookmark: ChannelBookmark;
    open: () => void;
};

const menuProps = {id: 'channelBookmarksDotMenuDropdown'};
const menuTransformOrigin = {vertical: 'top', horizontal: 'right'} as const;
const menuAnchorOrigin = {vertical: 'bottom', horizontal: 'right'} as const;

const trashCanIcon = <TrashCanOutlineIcon size={18}/>;
const linkVariantIcon = <LinkVariantIcon size={18}/>;
const pencilIcon = <PencilOutlineIcon size={18}/>;

const BookmarkItemDotMenu = ({
    bookmark,
    open,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const siteURL = getSiteURL();

    const isFile = bookmark.type === 'file';
    const hasLink = Boolean(bookmark.link_url);
    const openInNewTab = bookmark.type === 'link' && bookmark.link_url && shouldOpenInNewTab(bookmark.link_url, siteURL);

    const openIcon = useMemo(() => {
        if (isFile) {
            return <ArrowExpandIcon size={18}/>;
        } else if (hasLink) {
            return openInNewTab ? <OpenInNewIcon size={18}/> : <BookOutlineIcon size={18}/>;
        }
        return undefined;
    }, [hasLink, isFile, openInNewTab]);

    const canEdit = useChannelBookmarkPermission(bookmark.channel_id, 'edit');
    const canDelete = useChannelBookmarkPermission(bookmark.channel_id, 'delete');
    const canGetPublicLink = useCanGetPublicLink();

    const editLabel = formatMessage({id: 'channel_bookmarks.edit', defaultMessage: 'Edit'});
    const openLabel = formatMessage({id: 'channel_bookmarks.open', defaultMessage: 'Open'});
    const copyLinkLabel = formatMessage({id: 'channel_bookmarks.copy', defaultMessage: 'Copy link'});
    const copyFileLabel = formatMessage({id: 'channel_bookmarks.copyFilePublicLink', defaultMessage: 'Get a public link'});
    const deleteLabel = formatMessage({id: 'channel_bookmarks.delete', defaultMessage: 'Delete'});

    const editLabelWithSpan = useMemo(() => (<span>{editLabel}</span>), [editLabel]);
    const openLabelWithSpan = useMemo(() => (<span>{openLabel}</span>), [openLabel]);
    const copyLinkLabelWithSpan = useMemo(() => (<span>{copyLinkLabel}</span>), [copyLinkLabel]);
    const copyFileLabelWithSpan = useMemo(() => (<span>{copyFileLabel}</span>), [copyFileLabel]);
    const deleteLabelWithSpan = useMemo(() => (<span>{deleteLabel}</span>), [deleteLabel]);

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
    }, [dispatch, bookmark]);

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
    }, [dispatch, bookmark]);

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

    const menuButtonProps = useMemo(() => ({
        id: `channelBookmarksDotMenuButton-${bookmark.id}`,
        class: 'channelBookmarksDotMenuButton',
        children: <DotsHorizontalIcon size={18}/>,
        'aria-label': formatMessage({id: 'channel_bookmarks.editBookmarkLabel', defaultMessage: 'Bookmark menu'}),
    }), [bookmark.id, formatMessage]);

    return (
        <Menu.Container
            anchorOrigin={menuAnchorOrigin}
            transformOrigin={menuTransformOrigin}
            menuButton={menuButtonProps}
            menu={menuProps}
        >
            <Menu.Item
                key='channelBookmarksOpen'
                id='channelBookmarksOpen'
                onClick={open}
                leadingElement={openIcon}
                labels={openLabelWithSpan}
                aria-label={openLabel}
            />
            {canEdit && (
                <Menu.Item
                    key='channelBookmarksEdit'
                    id='channelBookmarksEdit'
                    onClick={handleEdit}
                    leadingElement={pencilIcon}
                    labels={editLabelWithSpan}
                    aria-label={editLabel}
                />
            )}
            {bookmark.type === 'link' && (
                <Menu.Item
                    key='channelBookmarksLinkCopy'
                    id='channelBookmarksLinkCopy'
                    onClick={copyLink}
                    leadingElement={linkVariantIcon}
                    labels={copyLinkLabelWithSpan}
                    aria-label={copyLinkLabel}
                />
            )}
            {bookmark.type === 'file' && canGetPublicLink && (
                <Menu.Item
                    key='channelBookmarksFileCopy'
                    id='channelBookmarksFileCopy'
                    onClick={handleGetPublicLink}
                    leadingElement={linkVariantIcon}
                    labels={copyFileLabelWithSpan}
                    aria-label={copyFileLabel}
                />
            )}
            {canDelete && (
                <Menu.Item
                    key='channelBookmarksDelete'
                    id='channelBookmarksDelete'
                    onClick={handleDelete}
                    leadingElement={trashCanIcon}
                    labels={deleteLabelWithSpan}
                    aria-label={deleteLabel}
                    isDestructive={true}
                />
            )}
        </Menu.Container>
    );
};

export default BookmarkItemDotMenu;
