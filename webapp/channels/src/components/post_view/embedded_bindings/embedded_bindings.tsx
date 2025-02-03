// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {AppBinding} from '@mattermost/types/apps';
import type {Post} from '@mattermost/types/posts';

import type {TextFormattingOptions} from 'utils/text_formatting';

import EmbeddedBinding from './embedded_binding';

type Props = {

    /**
     * The post id
     */
    post: Post;

    /**
     * Array of attachments to render
     */
    embeds: AppBinding[]; // Type App Embed Wrapper

    /**
     * Options specific to text formatting
     */
    options?: Partial<TextFormattingOptions>;

}

const EmbeddedBindings = ({
    embeds,
    post,
    options,
}: Props) => (
    <div
        id={`messageAttachmentList_${post.id}`}
        className='attachment__list'
    >
        {embeds.map((embed, i) => (
            <EmbeddedBinding
                embed={embed}
                post={post}
                key={'att_' + i}
                options={options}
            />
        ))}
    </div>
);

export default memo(EmbeddedBindings);
