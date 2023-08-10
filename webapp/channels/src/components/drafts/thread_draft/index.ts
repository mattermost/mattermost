// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {makeGetChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {makeGetThreadOrSynthetic} from 'mattermost-redux/selectors/entities/threads';

import ThreadDraft from './thread_draft';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

type OwnProps = {
    id: string;
    value: PostDraft;
}

function makeMapStatetoProps() {
    const getThreadOrSynthetic = makeGetThreadOrSynthetic();
    const getChannel = makeGetChannel();
    return (state: GlobalState, ownProps: OwnProps) => {
        const channel = getChannel(state, {id: ownProps.value.channelId});
        const post = getPost(state, ownProps.id);

        let thread;
        if (post) {
            thread = getThreadOrSynthetic(state, post);
        }

        return {
            channel,
            thread,
        };
    };
}

export default connect(makeMapStatetoProps)(ThreadDraft);
