// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostAttachment from './post_attachment.jsx';

import React from 'react';

export default class PostAttachmentList extends React.Component {
    render() {
        let content = [];
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

PostAttachmentList.propTypes = {
    attachments: React.PropTypes.array.isRequired
};
