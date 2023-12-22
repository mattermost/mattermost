// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';

import AttachmentCard from './attachment_card';
import FileCard from './file_card';

type Props = {
    post: Post;
}

function Attachment({post}: Props) {
    if (post.file_ids?.length) {
        return <FileCard id={post.file_ids[0]}/>;
    }

    if (post.props.attachments && post.props.attachments.length) {
        return <AttachmentCard {...post.props.attachments[0]}/>;
    }

    return null;
}

export default Attachment;
