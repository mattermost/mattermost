// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostAttachment from './post_attachment.jsx';

import PropTypes from 'prop-types';

import React from 'react';

export default function PostAttachmentList(props) {
    const content = [];
    props.attachments.forEach((attachment, i) => {
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

PostAttachmentList.propTypes = {
    attachments: PropTypes.array.isRequired
};
