// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Store} from 'redux';

import styled from 'styled-components';

import {GlobalState} from '@mattermost/types/store';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import {FormattedMessage} from 'react-intl';

import {KeyVariantCircleIcon} from '@mattermost/compass-icons/components';

import PlaybookRunPostMenuIcon from 'src/components/assets/icons/post_menu_icon';

import {addToTimeline, showPostMenuModal, startPlaybookRun} from 'src/actions';

import {useAllowAddMessageToTimelineInCurrentTeam} from 'src/hooks';
import {isProfessionalLicensedOrDevelopment} from 'src/license';

function shouldShowPostMenuForPost(store: Store, postId: string) {
    const state = store.getState() as GlobalState;
    const post = getPost(state, postId);
    return Boolean(post) && !isSystemMessage(post);
}

export const StartPlaybookRunPostMenuText = () => {
    return (
        <>
            <PlaybookRunPostMenuIcon data-testid={'playbookRunPostMenuIcon'}/>
            <FormattedMessage defaultMessage='Run playbook'/>
        </>
    );
};

const PositionedKeyVariantCircleIcon = styled(KeyVariantCircleIcon)`
    margin-bottom: -3px;
    margin-left: 16px;
    color: var(--online-indicator);
`;

export const AttachToPlaybookRunPostMenuText = () => {
    const allowMessage = useAllowAddMessageToTimelineInCurrentTeam();
    return (
        <>
            <PlaybookRunPostMenuIcon/>
            <FormattedMessage defaultMessage='Add to run timeline'/>
            {!allowMessage && <PositionedKeyVariantCircleIcon/>}
        </>
    );
};

export function makeStartPlaybookRunAction(store: Store) {
    return {
        text: StartPlaybookRunPostMenuText,
        action: (postId: string) => {
            const state = store.getState() as GlobalState;
            const post = getPost(state, postId);
            if (!post) {
                return;
            }
            const channel = getChannel(state, post.channel_id);
            if (!channel) {
                return;
            }
            store.dispatch(startPlaybookRun(channel.team_id, postId) as any);
        },
        filter: (postId: string) => {
            return shouldShowPostMenuForPost(store, postId);
        },
    };
}

export function makeAttachToPlaybookRunAction(store: Store) {
    return {
        text: AttachToPlaybookRunPostMenuText,
        action: (postId: string) => {
            const state = store.getState() as GlobalState;
            if (isProfessionalLicensedOrDevelopment(state)) {
                store.dispatch(addToTimeline(postId) as any);
            } else {
                store.dispatch(showPostMenuModal() as any);
            }
        },
        filter: (postId: string) => {
            return shouldShowPostMenuForPost(store, postId);
        },
    };
}
