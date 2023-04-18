// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {MessageAttachment as MessageAttachmentType} from '@mattermost/types/message_attachments';
import {PostImage} from '@mattermost/types/posts';

import {TextFormattingOptions} from 'utils/text_formatting';

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

export default class MessageAttachmentList extends React.PureComponent<Props> {
    static defaultProps = {
        imagesMetadata: {},
    };

    render() {
        const content = [] as JSX.Element[];
        this.props.attachments.forEach((attachment, i) => {
            content.push(
                <MessageAttachment
                    attachment={attachment}
                    postId={this.props.postId}
                    key={'att_' + i}
                    options={this.props.options}
                    imagesMetadata={this.props.imagesMetadata}
                />,
            );
        });

        return (
            <div
                id={`messageAttachmentList_${this.props.postId}`}
                className='attachment__list'
            >
                {content}
            </div>
        );
    }
}
