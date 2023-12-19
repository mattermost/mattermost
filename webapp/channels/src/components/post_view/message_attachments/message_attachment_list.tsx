// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {MessageAttachment as MessageAttachmentType} from '@mattermost/types/message_attachments';
import type {PostImage} from '@mattermost/types/posts';

import type {TextFormattingOptions} from 'utils/text_formatting';

import MessageAttachment from './message_attachment';

type Props = {

    /**
     * The post id
     */
    postId: string;

    /**
     * Array of attachments to render
     */
    attachments: MessageAttachmentType[];

    /**
     * Options specific to text formatting
     */
    options?: Partial<TextFormattingOptions>;

    /**
     * Images object used for creating placeholders to prevent scroll popup
     */
    imagesMetadata?: Record<string, PostImage>;
}

const EMPTY_METADATA: Record<string, PostImage> = {};

const MessageAttachmentList = ({
    imagesMetadata = EMPTY_METADATA,
    attachments,
    postId,
    options,
}: Props) => (
    <div
        id={`messageAttachmentList_${postId}`}
        className='attachment__list'
    >
        {attachments.map((attachment, i) => (
            <MessageAttachment
                attachment={attachment}
                postId={postId}
                key={'att_' + i}
                options={options}
                imagesMetadata={imagesMetadata}
            />
        ))}
    </div>
);

export default memo(MessageAttachmentList);
