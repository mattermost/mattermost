// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ChangeEvent} from 'react';
import React, {useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {
    LinkVariantIcon,
    PaperclipIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import type {ChannelBookmarkCreate} from '@mattermost/types/channel_bookmarks';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {createBookmark} from 'actions/channel_bookmarks';
import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import {clearFileInput} from 'utils/utils';

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

    const handleCreate = useCallback((file?: File) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_BOOKMARK_CREATE,
            dialogType: ChannelBookmarkCreateModal,
            dialogProps: {
                channelId,
                bookmarkType: file ? 'file' : 'link',
                file,
                onConfirm: async (data: ChannelBookmarkCreate) => dispatch(createBookmark(channelId, data)) as ActionResult<boolean>,
            },
        }));
    }, [channelId, dispatch]);

    const handleFileChanged = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            const [file] = e.target.files;
            handleCreate(file);
            clearFileInput(e.target);
        }
    }, [handleCreate]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInput = (
        <input
            type='file'
            id='bookmark-create-file-input'
            className='bookmark-create-file-input'
            ref={fileInputRef}
            onChange={handleFileChanged}
        />
    );

    const handleCreateLink = useCallback(() => {
        handleCreate();
    }, [handleCreate]);

    const handleCreateFile = useCallback(() => {
        fileInputRef.current?.click();
    }, [fileInputRef.current]);

    const addBookmarkLabel = formatMessage({id: 'channel_bookmarks.addBookmark', defaultMessage: 'Add a bookmark'});
    const addLinkLabel = formatMessage({id: 'channel_bookmarks.addLink', defaultMessage: 'Add a link'});
    const attachFileLabel = formatMessage({id: 'channel_bookmarks.attachFile', defaultMessage: 'Attach a file'});

    return (
        <PlusButtonContainer>
            <Menu.Container
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                menuButton={{
                    id: 'channelBookmarksPlusMenuButton',
                    class: classNames('channelBookmarksMenuButton', {rounded: !hasBookmarks}),
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
                    onClick={handleCreateFile}
                    leadingElement={<PaperclipIcon size={18}/>}
                    labels={<span>{attachFileLabel}</span>}
                    aria-label={attachFileLabel}
                />
            </Menu.Container>
            {fileInput}
        </PlusButtonContainer>
    );
};

export default PlusMenu;

const PlusButtonContainer = styled.div`
    position: sticky;
    right: 0;
    padding: 0 1rem;
    background: linear-gradient(to right, rgba(var(--center-channel-bg-rgb), .16), rgba(var(--center-channel-bg-rgb), 1) 25%);
`;
