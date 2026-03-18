// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {selectPostFromRightHandSideSearch} from 'actions/views/rhs';

type Props = {
    post: Post;
}

export default function DataSpillageFooter({post}: Props) {
    const dispatch = useDispatch();

    const onClick = useCallback(() => {
        if (post) {
            dispatch(selectPostFromRightHandSideSearch(post));
        }
    }, [dispatch, post]);

    return (
        <div
            className='DataSpillageFooter'
            data-testid='data-spillage-footer'
        >
            <button
                className='btn btn-primary btn-sm'
                data-testid='data-spillage-action-view-details'
                onClick={onClick}
            >
                <FormattedMessage
                    id='data_spillage_report.view_details.button_text'
                    defaultMessage='View details'
                />
            </button>
        </div>
    );
}
