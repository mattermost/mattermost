// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getSiteName} from 'mattermost-redux/selectors/entities/general';

import {ChannelsSettings} from './channel_settings';

function mapStateToProps(state: GlobalState) {
    return {
        siteName: getSiteName(state),
    };
}

export default connect(mapStateToProps)(ChannelsSettings);
