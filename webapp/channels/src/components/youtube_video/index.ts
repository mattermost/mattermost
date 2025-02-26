// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getOpenGraphMetadataForUrl} from 'mattermost-redux/selectors/entities/posts';

import type {GlobalState} from 'types/store';

import YoutubeVideo from './youtube_video';

type OwnProps = {
    postId: string;
    link: string;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);

    return {
        currentChannelId: getCurrentChannelId(state),
        googleDeveloperKey: config.GoogleDeveloperKey,
        hasImageProxy: config.HasImageProxy === 'true',
        metadata: getOpenGraphMetadataForUrl(state, ownProps.postId, ownProps.link),
        youtubeReferrerPolicy: config.YoutubeReferrerPolicy === 'true',
    };
}

export default connect(mapStateToProps)(YoutubeVideo);
