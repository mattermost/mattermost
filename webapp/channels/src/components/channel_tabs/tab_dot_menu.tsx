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

import ChannelTabsCreateModal from './channel_tabs_create_modal';
import TabDeleteModal from './tab_delete_modal';
import {useCanGetPublicLink, useChannelTabPermission} from './utils';

type Props = {tab: ChannelTab; open: () => void};
const TabItemDotMenu = ({
    tab,
    open,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const fileInfo = useSelector((state: GlobalState) => (tab?.file_id && getFile(state, tab.file_id)) || undefined);

    const siteURL = getSiteURL();
    const openInNewTab = tab.type === 'link' && tab.link_url && shouldOpenInNewTab(tab.link_url, siteURL);

    let openIcon;
    if (tab.type === 'file') {
        openIcon = <ArrowExpandIcon size={18}/>;
    } else if (tab.link_url) {
        openIcon = openInNewTab ? <OpenInNewIcon size={18}/> : <BookOutlineIcon size={18}/>;
    }

    const canEdit = useChannelTabPermission(tab.channel_id, 'edit');
    const canDelete = useChannelTabPermission(tab.channel_id, 'delete');
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
                tab,
                channelId: tab.channel_id,
                onConfirm: async (data: ChannelTabPatch) => dispatch(editTab(tab.channel_id, tab.id, data)) as ActionResult<boolean>,
            },
        }));
    }, [editTab, dispatch, tab]);

    const copyLink = useCallback(() => {
        if (tab.type === 'link' && tab.link_url) {
            copyToClipboard(tab.link_url);
        } else if (tab.type === 'file' && tab.file_id) {
            copyToClipboard(getFileDownloadUrl(tab.file_id));
        }
    }, [tab.type, tab.link_url, tab.file_id]);

    const handleDelete = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_TAB_DELETE,
            dialogType: TabDeleteModal,
            dialogProps: {
                displayName: tab.display_name,
                onConfirm: () => dispatch(deleteTab(tab.channel_id, tab.id)),
            },
        }));
    }, [deleteTab, dispatch, tab]);

    const handleGetPublicLink = useCallback(() => {
        if (!tab.file_id) {
            return;
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.GET_PUBLIC_LINK_MODAL,
            dialogType: GetPublicModal,
            dialogProps: {
                fileId: tab.file_id,
            },
        }));
    }, [tab.file_id, dispatch]);

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
                id: `channelTabsDotMenuButton-${tab.id}`,
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
            {tab.type === 'link' && (
                <Menu.Item
                    key='channelTabsLinkCopy'
                    id='channelTabsLinkCopy'
                    onClick={copyLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{copyLinkLabel}</span>}
                    aria-label={copyLinkLabel}
                />
            )}
            {tab.type === 'file' && canGetPublicLink && (
                <Menu.Item
                    key='channelTabsFileCopy'
                    id='channelTabsFileCopy'
                    onClick={handleGetPublicLink}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={<span>{copyFileLabel}</span>}
                    aria-label={copyFileLabel}
                />
            )}
            {tab.type === 'file' && fileInfo && (
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
