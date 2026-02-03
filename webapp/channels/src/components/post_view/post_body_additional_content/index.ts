// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {toggleEmbedVisibility} from 'actions/post_actions';
import {isEmbedVisible} from 'selectors/posts';

import type {GlobalState} from 'types/store';

import PostBodyAdditionalContent from './post_body_additional_content';
import type {
    Props,
} from './post_body_additional_content';

function mapStateToProps(state: GlobalState, ownProps: Omit<Props, 'appsEnabled' | 'actions' | 'embedYoutubeEnabled'>) {
    const config = getConfig(state);

    return {
        isEmbedVisible: isEmbedVisible(state, ownProps.post.id),
        pluginPostWillRenderEmbedComponents: state.plugins.components.PostWillRenderEmbedComponent,
        appsEnabled: appsEnabled(state),
        embedYoutubeEnabled: config.FeatureFlagEmbedYoutube === 'true',
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({toggleEmbedVisibility}, dispatch),
    };
}

export default connect(
    mapStateToProps,
    mapDispatchToProps,
)(PostBodyAdditionalContent);
