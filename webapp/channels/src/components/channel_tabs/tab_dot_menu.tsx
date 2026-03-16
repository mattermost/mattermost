// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {
    DotsHorizontalIcon,
    PencilOutlineIcon,
    LinkVariantIcon,
    TrashCanOutlineIcon,
    ArrowExpandIcon,
    OpenInNewIcon,
    BookOutlineIcon,
    DownloadOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelTab, ChannelTabPatch} from '@mattermost/types/channel_tabs';

import {getFile} from 'mattermost-redux/selectors/entities/files';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {getFileDownloadUrl} from 'mattermost-redux/utils/file_utils';

import {editTab, deleteTab} from 'actions/channel_tabs';
import {openModal} from 'actions/views/modals';

import GetPublicModal from 'components/get_public_link_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import {getSiteURL, shouldOpenInNewTab} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';

import TabDeleteModal from './tab_delete_modal';
import ChannelTabsCreateModal from './channel_tabs_create_modal';
import {useCanGetPublicLink, useChannelTabPermission} from './utils';

type Props = {bookmark: ChannelTab; open: () => void};
const TabItemDotMenu = ({
    bookmark,
    open,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const fileInfo = useSelector((state: GlobalState) => (bookmark?.file_id && getFile(state, bookmark.file_id)) || undefined);

    const siteURL = getSiteURL();
    const openInNewTab = bookmark.type === 'link' && bookmark.link_url && shouldOpenInNewTab(bookmark.link_url, siteURL);

    let openIcon;
    if (bookmark.type === 'file') {
        openIcon = <ArrowExpandIcon size={18}/>;
    } else if (bookmark.link_url) {
        openIcon = openInNewTab ? <OpenInNewIcon size={18}/> : <BookOutlineIcon size={18}/>;
    }

    const canEdit = useChannelTabPermission(bookmark.channel_id, 'edit');
    const canDelete = useChannelTabPermission(bookmark.channel_id, 'delete');
    const canGetPublicLink = useCanGetPublicLink();

    const editLabel = formatMessage({id: 'channel_bookmarks.edit', defaultMessage: 'Edit'});
    const openLabel = formatMessage({id: 'channel_bookmarks.open', defaultMessage: 'Open'});
    const copyLinkLabel = formatMessage({id: 'channel_bookmarks.copy', defaultMessage: 'Copy link'});
    const copyFileLabel = formatMessage({id: 'channel_bookmarks.copyFilePublicLink', defaultMessage: 'Get a public link'});
    const downloadLabel = formatMessage({id: 'channel_bookmarks.download', defaultMessage: 'Download'});
    const deleteLabel = formatMessage({id: 'channel_bookmarks.delete', defaultMessage: 'Delete'});

    const handleEdit = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_TAB_CREATE,
            dialogType: ChannelTabsCreateModal,
            dialogProps: {
                bookmark,
                channelId: bookmark.channel_id,
                onConfirm: async (data: ChannelTabPatch) => dispatch(editTab(bookmark.channel_id, bookmark.id, data)) as ActionResult<boolean>,
            },
        }));
    }, [editTab, dispatch, bookmark]);

    const copyLink = useCallback(() => {
        if (bookmark.type === 'link' && bookmark.link_url) {
            copyToClipboard(bookmark.link_url);
        } else if (bookmark.type === 'file' && bookmark.file_id) {
            copyToClipboard(getFileDownloadUrl(bookmark.file_id));
        }
    }, [bookmark.type, bookmark.link_url, bookmark.file_id]);

    const handleDelete = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_TAB_DELETE,
            dialogType: TabDeleteModal,
            dialogProps: {
                displayName: bookmark.display_name,
                onConfirm: () => dispatch(deleteTab(bookmark.channel_id, bookmark.id)),
            },
        }));
    }, [deleteTab, dispatch, bookmark]);

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

    const handleDownload = useCallback(() => {
        if (fileInfo) {
            window.open(getFileDownloadUrl(fileInfo.id), '_blank');
        }
    }, [fileInfo]);

    return (
        <Menu.Container
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
            menuButton={{
                id: `channelTabsDotMenuButton-${bookmark.id}`,
                class: 'channelTabsDotMenuButton',
                children: <DotsHorizontalIcon size={18}/>,
                'aria-label': formatMessage({id: 'channel_bookmarks.editBookmarkLabel', defaultMessage: 'Tab menu'}),
            }}
            menu={{
                id: 'channelTabsDotMenuDropdown',
            }}
        >
            <Menu.Item
                key='channelTabsOpen'
                id='channelTabsOpen'
                onClick={open}
                leadingElement={openIcon}
                labels={<span>{openLabel}</span>}
                aria-label={openLabel}
            />
            {canEdit && (
                <Menu.Item
                    key='channelTabsEdit'
                    id='channelTabsEdit'
                    onClick={handleEdit}
                    leadingElement={<PencilOutlineIcon size={18}/>}
                    labels={<span>{editLabel}</span>}
                    aria-label={editLabel}
                />
            )}
            {bookmark.type === 'link' && (
                <Menu.Item
                    key='channelTabsLinkCopy'
                    id='channelTabsLinkCopy'
                    onClick={copyLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{copyLinkLabel}</span>}
                    aria-label={copyLinkLabel}
                />
            )}
            {bookmark.type === 'file' && canGetPublicLink && (
                <Menu.Item
                    key='channelTabsFileCopy'
                    id='channelTabsFileCopy'
                    onClick={handleGetPublicLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{copyFileLabel}</span>}
                    aria-label={copyFileLabel}
                />
            )}
            {bookmark.type === 'file' && fileInfo && (
                <Menu.Item
                    key='channelTabsDownload'
                    id='channelTabsDownload'
                    onClick={handleDownload}
                    leadingElement={<DownloadOutlineIcon size={18}/>}
                    labels={<span>{downloadLabel}</span>}
                    aria-label={downloadLabel}
                />
            )}
            {canDelete && (
                <Menu.Item
                    key='channelTabsDelete'
                    id='channelTabsDelete'
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

export default TabItemDotMenu;
