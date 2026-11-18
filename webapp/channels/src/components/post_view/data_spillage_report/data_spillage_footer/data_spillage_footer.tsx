// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/compass-ui/components/button';
import type {Post} from '@mattermost/types/posts';

import {selectPostFromRightHandSideSearch} from 'actions/views/rhs';

type Props = {
    post: Post;
    testIdScope?: string;
};

export default function DataSpillageFooter({post, testIdScope}: Props) {
    const dispatch = useDispatch();

    const onClick = useCallback(() => {
        if (post) {
            dispatch(selectPostFromRightHandSideSearch(post));
        }
    }, [dispatch, post]);

    return (
        <div
            className='DataSpillageFooter'
            data-testid={testIdScope}
        >
            <Button
                emphasis='primary'
                size='small'
                data-testid={testIdScope ? `${testIdScope}.view_details--button` : undefined}
                onClick={onClick}
            >
                <FormattedMessage
                    id='data_spillage_report.view_details.button_text'
                    defaultMessage='View details'
                />
            </Button>
        </div>
    );
}
