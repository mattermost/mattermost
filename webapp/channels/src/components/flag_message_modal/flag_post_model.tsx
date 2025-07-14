// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {PostPreviewMetadata} from '@mattermost/types/posts';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import PostMessagePreview from 'components/post_view/post_message_preview';

import type {GlobalState} from 'types/store';

const noop = () => {};

type Props = {
    postId: string;
}

export default function FlagPostModal({postId}: Props) {
    const {formatMessage} = useIntl();

    const label = formatMessage({id: 'flag_message_modal.heading', defaultMessage: 'Flag message'});
    const subHeading = formatMessage({id: 'flag_message_modal.subheading', defaultMessage: 'Flagged messages will be sent to Content Reviewers for review'});
    const submitButtonText = formatMessage({id: 'generic.submit', defaultMessage: 'Submit'});

    const post = useSelector((state: GlobalState) => getPost(state, postId));
    const channel = useSelector((state: GlobalState) => getChannel(state, post.channel_id));
    const currentTeam = useSelector(getCurrentTeam);

    const previewMetadata: PostPreviewMetadata = {
        post,
        post_id: post.id,
        team_name: currentTeam?.name || '',
        channel_display_name: channel?.display_name || '',
        channel_type: channel?.type || 'O',
        channel_id: channel?.id || '',
    };

    return (
        <GenericModal
            id='FlagPostModal'
            ariaLabel={label}
            modalHeaderText={label}
            modalSubheaderText={subHeading}
            compassDesign={true}
            keyboardEscape={true}
            enforceFocus={false}
            handleConfirm={noop}
            handleCancel={noop}
            confirmButtonText={submitButtonText}
        >
            <div className='FlagPostModal__body'>
                <div className='FlagPostModal__post_preview'>
                    <div className='FlagPostModal__section_title'>
                        <FormattedMessage
                            id='flag_message_modal.post_preview.title'
                            defaultMessage='Message to be flagged'
                        />
                    </div>
                    <div
                        className='post forward-post__post-preview--override'
                    >
                        <PostMessagePreview
                            metadata={previewMetadata}
                            handleFileDropdownOpened={noop}
                            preventClickAction={true}
                        />
                    </div>
                </div>
            </div>
        </GenericModal>
    );
}
