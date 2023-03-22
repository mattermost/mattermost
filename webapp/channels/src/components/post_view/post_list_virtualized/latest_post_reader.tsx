// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {Post} from '@mattermost/types/posts';

import {GlobalState} from 'types/store';

import {getLatestPostId, makeCreateAriaLabelForPost} from 'utils/post_utils';

interface Props {
    postIds?: string[];
}

const LatestPostReader = (props: Props): JSX.Element => {
    const intl = useIntl();

    const {postIds} = props;
    const latestPostId = useMemo(() => getLatestPostId(postIds || []), [postIds]);
    const latestPost = useSelector<GlobalState, Post>((state) => getPost(state, latestPostId));

    const createAriaLabelForPost = useRef(makeCreateAriaLabelForPost());
    const ariaLabel = useSelector<GlobalState, string>((state) => {
        if (!latestPost) {
            return '';
        }

        return createAriaLabelForPost.current(state, latestPost)(intl);
    });

    return (
        <span
            className='sr-only'
            aria-live='polite'
        >
            {ariaLabel}
        </span>
    );
};

export default LatestPostReader;
