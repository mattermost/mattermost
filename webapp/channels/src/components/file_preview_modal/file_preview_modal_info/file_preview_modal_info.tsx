// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {
    getUser as selectUser,
    makeGetDisplayName,
} from 'mattermost-redux/selectors/entities/users';
import {Post} from '@mattermost/types/posts';
import {UserProfile} from '@mattermost/types/users';

import Avatar from 'components/widgets/users/avatar/avatar';

import {GlobalState} from 'types/store';

import {imageURLForUser} from 'utils/utils';

import './file_preview_modal_info.scss';

interface Props {
    showFileName: boolean;
    filename: string;
    post?: Post;
}

const displayNameGetter = makeGetDisplayName();

const FilePreviewModalInfo: React.FC<Props> = (props: Props) => {
    const user = useSelector((state: GlobalState) => selectUser(state, props.post?.user_id ?? '')) as UserProfile | undefined;
    const channel = useSelector((state: GlobalState) => {
        const getChannel = makeGetChannel();
        return getChannel(state, {id: props.post?.channel_id ?? ''});
    });
    const name = useSelector((state: GlobalState) => displayNameGetter(state, props.post?.user_id ?? '', true));

    let info;
    const channelName = channel ? (
        <FormattedMessage
            id='file_preview_modal_info.shared_in'
            defaultMessage='Shared in ~{name}'
            values={{
                name: channel.display_name || channel.name,
            }}
        />
    ) : null;
    if (props.showFileName) {
        info = (
            <>
                <h5 className='file-preview-modal__file-name'>{props.filename}
                </h5>
                <span className='file-preview-modal__file-details'>
                    <span className='file-preview-modal__file-details-user-name'>{name}</span>
                    <span className='file-preview-modal__channel'>{channelName}</span>
                </span>
            </>
        );
    } else {
        info = (
            <>
                <h5 className='file-preview-modal__user-name'>{name}
                </h5>
                <span className='file-preview-modal__channel'>{channelName}
                </span>
            </>
        );
    }

    return (
        <div className='file-preview-modal__info'>
            {
                (props.post && Object.keys(props.post).length > 0) &&
                <Avatar
                    size='lg'
                    url={imageURLForUser(props.post.user_id, user?.last_picture_update)}
                    className='file-preview-modal__avatar'
                />
            }

            <div className='file-preview-modal__info-details'>
                {info}
            </div>
        </div>
    );
};

export default memo(FilePreviewModalInfo);
