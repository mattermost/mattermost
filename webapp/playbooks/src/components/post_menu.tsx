// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';

import styled from 'styled-components';

import {GlobalState} from '@mattermost/types/store';
import {Post} from '@mattermost/types/posts';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {Channel} from '@mattermost/types/channels';

import {FormattedMessage} from 'react-intl';

import {KeyVariantCircleIcon} from '@mattermost/compass-icons/components';

import PlaybookRunPostMenuIcon from 'src/components/assets/icons/post_menu_icon';

import {addToTimeline, showPostMenuModal, startPlaybookRun} from 'src/actions';

import {useAllowAddMessageToTimelineInCurrentTeam} from 'src/hooks';

interface Props {
    postId: string;
}

export const StartPlaybookRunPostMenu = (props: Props) => {
    const dispatch = useDispatch();
    const channel = useSelector<GlobalState, Channel | null>((state) => {
        const post = getPost(state, props.postId);
        if (!post || isSystemMessage(post)) {
            return null;
        }
        return getChannel(state, post.channel_id);
    });
    if (!channel) {
        return null;
    }

    const handleClick = () => {
        dispatch(startPlaybookRun(channel.team_id, props.postId));
    };

    return (
        <React.Fragment>
            <li
                className='MenuItem'
                role='menuitem'
                onClick={handleClick}
            >
                <button
                    data-testid='playbookRunPostMenuIcon'
                    className='style--none'
                    role='presentation'
                >
                    <PlaybookRunPostMenuIcon/>
                    <FormattedMessage defaultMessage='Run playbook'/>
                </button>
            </li>
        </React.Fragment>
    );
};

export const AttachToPlaybookRunPostMenu = (props: Props) => {
    const dispatch = useDispatch();
    const allowMessage = useAllowAddMessageToTimelineInCurrentTeam();

    const post = useSelector<GlobalState, Post>((state) => getPost(state, props.postId));
    if (!post || isSystemMessage(post)) {
        return null;
    }

    const handleClick = () => {
        if (allowMessage) {
            dispatch(addToTimeline(props.postId));
        } else {
            dispatch(showPostMenuModal());
        }
    };

    return (
        <React.Fragment>
            <li
                className='MenuItem'
                role='menuitem'
                onClick={handleClick}
            >
                <button
                    data-testid='playbookRunAddToTimeline'
                    className='style--none'
                    role='presentation'
                >
                    <PlaybookRunPostMenuIcon/>
                    <FormattedMessage defaultMessage='Add to run timeline'/>
                    {!allowMessage && <PositionedKeyVariantCircleIcon/>}
                </button>
            </li>
        </React.Fragment>
    );
};

const PositionedKeyVariantCircleIcon = styled(KeyVariantCircleIcon)`
    margin-left: 16px;
    margin-bottom: -3px;
    color: var(--online-indicator);
`;
