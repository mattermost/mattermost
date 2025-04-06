// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import {RefreshIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {FileInfo} from '@mattermost/types/files';
import type {Post} from '@mattermost/types/posts';

import type {ExtendedPost} from 'mattermost-redux/actions/posts';

import WithTooltip from 'components/with_tooltip';

import {Locations} from 'utils/constants';

type Props = {
    post: Post;
    location: keyof typeof Locations;
    actions: {
        createPost: (post: Post, files: FileInfo[]) => void;
        removePost: (post: ExtendedPost) => void;
    };
};

const FailedPostOptions = ({
    post,
    location,
    actions,
}: Props) => {
    const retryPost = useCallback((e: MouseEvent): void => {
        e.preventDefault();

        const postDetails = {...post};
        Reflect.deleteProperty(postDetails, 'id');
        actions.createPost(postDetails, []);
    }, [actions, post]);

    const cancelPost = useCallback((e: MouseEvent): void => {
        e.preventDefault();

        actions.removePost(post);
    }, [actions, post]);

    const isRHS = location === Locations.RHS_ROOT || location === Locations.RHS_COMMENT;

    return (
        <div className='failed-post-buttons'>
            <WithTooltip
                title={
                    <FormattedMessage
                        id='pending_post_actions.retry'
                        defaultMessage='Retry'
                    />
                }
            >
                <button
                    className={classNames('btn', 'btn-tertiary', 'btn-sm')}
                    onClick={retryPost}
                    aria-label='Retry'
                >
                    <RefreshIcon
                        size={14}
                        color='currentColor'
                    />
                    {!isRHS && (
                        <span className='btn__label'>
                            <FormattedMessage
                                id='pending_post_actions.retry'
                                defaultMessage='Retry'
                            />
                        </span>
                    )}
                </button>
            </WithTooltip>
            <WithTooltip
                title={
                    <FormattedMessage
                        id='pending_post_actions.cancel'
                        defaultMessage='Cancel'
                    />
                }
            >
                <button
                    className={classNames('btn', 'btn-tertiary', 'btn-danger', 'btn-sm', {'btn-icon': isRHS})}
                    onClick={cancelPost}
                    aria-label='Cancel'
                >
                    <TrashCanOutlineIcon
                        size={14}
                        color='currentColor'
                    />
                    {!isRHS && (
                        <span className='btn__label'>
                            <FormattedMessage
                                id='pending_post_actions.cancel'
                                defaultMessage='Cancel'
                            />
                        </span>
                    )}
                </button>
            </WithTooltip>
        </div>
    );
};

export default memo(FailedPostOptions);
