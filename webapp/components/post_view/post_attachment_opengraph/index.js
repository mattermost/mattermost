// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {bindActionCreators} from 'redux';
import {getOpenGraphMetadata} from 'mattermost-redux/actions/posts';
import {getOpenGraphMetadataForUrl} from 'mattermost-redux/selectors/entities/posts';

import PostAttachmentOpenGraph from './post_attachment_opengraph.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        openGraphData: getOpenGraphMetadataForUrl(state, ownProps.link),
        currentUser: getCurrentUser(state),
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getOpenGraphMetadata
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PostAttachmentOpenGraph);
