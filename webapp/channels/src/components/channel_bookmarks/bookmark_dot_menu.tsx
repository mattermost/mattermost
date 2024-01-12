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
} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {deleteBookmark} from 'mattermost-redux/actions/channel_bookmarks';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import {copyToClipboard} from 'utils/utils';

import BookmarkDeleteModal from './bookmark_delete_modal';

type Props = {bookmark: ChannelBookmark};
const BookmarkItemDotMenu = ({
    bookmark,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const editLabel = formatMessage({id: 'channel_bookmarks.edit', defaultMessage: 'Edit'});
    const copyLabel = formatMessage({id: 'channel_bookmarks.copy', defaultMessage: 'Copy link'});
    const deleteLabel = formatMessage({id: 'channel_bookmarks.delete', defaultMessage: 'Delete'});

    const copyLink = useCallback(() => {
        if (bookmark.type === 'link' && bookmark.link_url) {
            copyToClipboard(bookmark.link_url);
        } else if (bookmark.type === 'file') {
            // TODO
        }
    }, [bookmark.type, bookmark.link_url]);

    const handleDelete = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_BOOKMARK_DELETE,
            dialogType: BookmarkDeleteModal,
            dialogProps: {
                displayName: bookmark.display_name,
                onConfirm: () => dispatch(deleteBookmark(bookmark.channel_id, bookmark.id)),
            },
        }));
    }, [bookmark, dispatch]);

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
                key='channelBookmarksEdit'
                id='channelBookmarksEdit'
                onClick={() => {

                }}
                leadingElement={<PencilOutlineIcon size={18}/>}
                labels={<span>{editLabel}</span>}
                aria-label={editLabel}
            />
            <Menu.Item
                key='channelBookmarksCopy'
                id='channelBookmarksCopy'
                onClick={copyLink}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={<span>{copyLabel}</span>}
                aria-label={copyLabel}
            />
            <Menu.Item
                key='channelBookmarksDelete'
                id='channelBookmarksDelete'
                onClick={handleDelete}
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                labels={<span>{deleteLabel}</span>}
                aria-label={deleteLabel}
                isDestructive={true}
            />
        </Menu.Container>
    );
};

export default BookmarkItemDotMenu;
