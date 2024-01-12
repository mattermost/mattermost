// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {GenericModal} from '@mattermost/components';
import type {ChannelBookmark, ChannelBookmarkCreate} from '@mattermost/types/channel_bookmarks';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Input from 'components/widgets/inputs/input/input';

import './bookmark_create_modal.scss';

type Props = {
    bookmarkType: ChannelBookmark['type'];
    onConfirm: (data: ChannelBookmarkCreate) => Promise<ActionResult<boolean>>;
    onExited: () => void;
    onHide: () => void;
}

function ChannelBookmarkCreateModal({
    bookmarkType,
    onExited,
    onConfirm,
    onHide,
}: Props) {
    const {formatMessage} = useIntl();
    const [link, setLink] = useState('');
    const [linkError, setLinkError] = useState('');
    const [title, setTitle] = useState('');

    const cancel = () => {};
    const confirm = async () => {
        if (bookmarkType === 'link') {
            const data: ChannelBookmarkCreate = {
                link_url: link,
                display_name: title,
                type: 'link',
            };

            const {data: success} = await onConfirm(data);

            if (success) {
                setLinkError('');
                onHide();
            } else {
                setLinkError(formatMessage({
                    id: 'channel_bookmarks.create.error.invalid_url',
                    defaultMessage: 'Invalid link',
                }));
            }
        }
    };

    const heading = formatMessage({
        id: 'channel_bookmarks.create.title',
        defaultMessage: 'Add a bookmark',
    });

    const linkPlaceholder = formatMessage({
        id: 'channel_bookmarks.create.link_placeholder',
        defaultMessage: 'Link',
    });

    const titlePlaceholder = formatMessage({
        id: 'channel_bookmarks.create.title_placeholder',
        defaultMessage: 'Title',
    });

    const linkInfoMessage = formatMessage({
        id: 'channel_bookmarks.create.link_info',
        defaultMessage: 'Add a link to any post, file, or any external link',
    });

    const confirmButtonText = formatMessage({
        id: 'channel_bookmarks.create.confirm.button',
        defaultMessage: 'Add bookmark',
    });

    return (
        <GenericModal
            className='channel-bookmarks-create-modal'
            confirmButtonText={confirmButtonText}
            handleCancel={cancel}
            handleConfirm={confirm}
            modalHeaderText={heading}
            onExited={onExited}
            compassDesign={true}
            isConfirmDisabled={!link || !title}
            autoCloseOnConfirmButton={false}
        >
            <Input
                type='text'
                placeholder={linkPlaceholder}
                onChange={({currentTarget}) => setLink(currentTarget.value)}
                value={link}
                data-testid='linkInput'
                autoFocus={true}
                customMessage={linkError ? {type: 'error', value: linkError} : {value: linkInfoMessage}}
            />
            {link && (
                <TitleWrapper>
                    <Input
                        type='text'
                        placeholder={titlePlaceholder}
                        onChange={({currentTarget}) => setTitle(currentTarget.value)}
                        value={title}
                        data-testid='titleInput'
                    />
                </TitleWrapper>
            )}

        </GenericModal>
    );
}

export default ChannelBookmarkCreateModal;

const TitleWrapper = styled.div`
    margin-top: 20px;
`;
