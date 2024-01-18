// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {GenericModal} from '@mattermost/components';
import type {ChannelBookmark, ChannelBookmarkCreate} from '@mattermost/types/channel_bookmarks';
import type {FileInfo} from '@mattermost/types/files';

import {Client4} from 'mattermost-redux/client';
import type {ActionResult} from 'mattermost-redux/types/actions';

import FileAttachment from 'components/file_attachment/file_attachment';
import Input from 'components/widgets/inputs/input/input';

import './bookmark_create_modal.scss';

type Props = {
    channelId: string;
    bookmarkType: ChannelBookmark['type'];
    onConfirm: (data: ChannelBookmarkCreate) => Promise<ActionResult<boolean, any>> | ActionResult<boolean, any>;
    onExited: () => void;
    onHide: () => void;
}

function validHttpUrl(val: string) {
    let url;

    try {
        url = new URL(val);
    } catch {
        return null;
    }

    if (!url.protocol) {
        url.protocol = 'https:';
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
    }

    return url;
}

function ChannelBookmarkCreateModal({
    bookmarkType,
    channelId,
    onExited,
    onConfirm,
    onHide,
}: Props) {
    const {formatMessage} = useIntl();
    const [link, setLink] = useState('');
    const [linkError, setLinkError] = useState('');
    const [title, setTitle] = useState('');

    const linkInvalidMsg = formatMessage({id: 'channel_bookmarks.create.error.invalid_url', defaultMessage: 'Invalid link'});
    const timestammp = useMemo(() => new Date().getTime(), []);

    useEffect(() => {
        const url = validHttpUrl(link);

        if (url) {
            setLinkError('');
            (async () => {
                const meta = await Client4.fetchChannelBookmarkOpenGraph(channelId, url.toString(), timestammp);
                console.log({meta});
            })();
        } else {
            setLinkError(linkInvalidMsg);
        }
    }, [link]);

    const linkIsValid = Boolean(link); // TODO opengraph validation
    const showControls = linkIsValid;

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
                setLinkError(linkInvalidMsg);
            }
        }
    };

    const heading = formatMessage({id: 'channel_bookmarks.create.title', defaultMessage: 'Add a bookmark'});
    const linkPlaceholder = formatMessage({id: 'channel_bookmarks.create.link_placeholder', defaultMessage: 'Link'});
    const titlePlaceholder = formatMessage({id: 'channel_bookmarks.create.title_placeholder', defaultMessage: 'Title'});
    const linkInfoMessage = formatMessage({id: 'channel_bookmarks.create.link_info', defaultMessage: 'Add a link to any post, file, or any external link'});
    const confirmButtonText = formatMessage({id: 'channel_bookmarks.create.confirm.button', defaultMessage: 'Add bookmark'});

    return (
        <GenericModal
            className='channel-bookmarks-create-modal'
            confirmButtonText={confirmButtonText}
            handleCancel={(linkIsValid && cancel) || undefined}
            handleConfirm={(linkIsValid && confirm) || undefined}
            modalHeaderText={heading}
            onExited={onExited}
            compassDesign={true}
            isConfirmDisabled={!link || !title}
            autoCloseOnConfirmButton={false}
        >

            {bookmarkType === 'link' ? (
                <Input
                    type='text'
                    placeholder={linkPlaceholder}
                    onChange={({currentTarget}) => setLink(currentTarget.value)}
                    value={link}
                    data-testid='linkInput'
                    autoFocus={true}
                    customMessage={linkError ? {type: 'error', value: linkError} : {value: linkInfoMessage}}
                />
            ) : (
                <FileInput/>
            )}

            {showControls && (
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

type FileInputProps = {};
const FileInput = ({

}: FileInputProps) => {
    return (
        <FileInputContainer/>
    );
};

const FileInputContainer = styled.div`


`;

const FileItem = () => {

};

const FileItemContainer = styled.div`


`;
