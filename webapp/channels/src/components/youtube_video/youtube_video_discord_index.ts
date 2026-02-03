// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getOpenGraphMetadataForUrl} from 'mattermost-redux/selectors/entities/posts';

import type {GlobalState} from 'types/store';

import YoutubeVideoDiscord from './youtube_video_discord';

type OwnProps = {
    postId: string;
    link: string;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);

    return {
        metadata: getOpenGraphMetadataForUrl(state, ownProps.postId, ownProps.link),
        youtubeReferrerPolicy: config.YoutubeReferrerPolicy === 'true',
    };
}

export default connect(mapStateToProps)(YoutubeVideoDiscord);
