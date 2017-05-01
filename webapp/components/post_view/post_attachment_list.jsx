// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostAttachment from './post_attachment.jsx';

import React from 'react';
import PropTypes from 'prop-types';

export default class PostAttachmentList extends React.PureComponent {
    static propTypes = {

        /**
         * Array of attachments to render
         */
        attachments: PropTypes.array.isRequired
    }

    render() {
        const content = [];
        this.props.attachments.forEach((attachment, i) => {
            content.push(
                <PostAttachment
                    attachment={attachment}
                    key={'att_' + i}
                />
            );
        });

        return (
            <div className='attachment_list'>
                {content}
            </div>
        );
    }
}
