// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmark, ChannelBookmarkCreate} from '@mattermost/types/channel_bookmarks';

import {createBookmark} from 'mattermost-redux/actions/channel_bookmarks';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import ChannelBookmarkCreateModal from './channel_bookmarks_create_modal';

type PlusMenuProps = {
    channelId: string;
    hasBookmarks: boolean;
};
const PlusMenu = ({
    channelId,
    hasBookmarks,
}: PlusMenuProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const addBookmarkLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'});
    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});

    const handleCreate = useCallback((type: ChannelBookmark['type']) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_BOOKMARK_CREATE,
            dialogType: ChannelBookmarkCreateModal,
            dialogProps: {
                bookmarkType: type,
                onConfirm: async (data: ChannelBookmarkCreate) => dispatch(createBookmark(channelId, data)) as ActionResult<boolean>,
            },
        }));
    }, [channelId, dispatch]);

    const handleCreateLink = useCallback(() => {
        handleCreate('link');
    }, [handleCreate]);

    return (
        <Menu.Container
            anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
            transformOrigin={{vertical: 'top', horizontal: 'left'}}
            menuButton={{
                id: 'channelBookmarksPlusMenuButton',
                class: hasBookmarks ? '' : 'rounded',
                children: (
                    <>
                        <PlusIcon size={18}/>
                        {!hasBookmarks && <span>{addBookmarkLabel}</span>}
                    </>
                ),
                'aria-label': addBookmarkLabel,
            }}
            menu={{
                id: 'channelBookmarksPlusMenuDropdown',
            }}
            menuButtonTooltip={hasBookmarks ? {
                id: 'channelBookmarksPlusMenuButtonTooltip',
                text: addBookmarkLabel,
            } : undefined}
        >
            <Menu.Item
                key='channelBookmarksAddLink'
                id='channelBookmarksAddLink'
                onClick={handleCreateLink}
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={<span>{addLinkLabel}</span>}
                aria-label={addLinkLabel}
            />
            <Menu.Item
                key='channelBookmarksAttachFile'
                id='channelBookmarksAttachFile'
                onClick={() => {

                }}
                leadingElement={<PaperclipIcon size={18}/>}
                labels={<span>{attachFileLabel}</span>}
                aria-label={attachFileLabel}
            />
        </Menu.Container>
    );
};

export default PlusMenu;
