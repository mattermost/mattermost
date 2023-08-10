// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {usePostAriaLabel} from 'utils/post_utils';

import type {Post} from '@mattermost/types/posts';

export type Props = React.HTMLProps<HTMLDivElement> & {
    post: Post;
}

const PostAriaLabelDiv = React.forwardRef((props: Props, ref: React.Ref<HTMLDivElement>) => {
    const {
        children,
        post,
        ...otherProps
    } = props;

    const ariaLabel = usePostAriaLabel(post);

    return (
        <div
            ref={ref}
            aria-label={ariaLabel}
            {...otherProps}
        >
            {children}
        </div>
    );
});

PostAriaLabelDiv.displayName = 'PostAriaLabelDiv';

export default PostAriaLabelDiv;
