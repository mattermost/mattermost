// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import GiphyGif from './giphy_gif.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        currentChannelId: getCurrentChannelId(state)
    };
}

export default connect(mapStateToProps)(GiphyGif);