// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import FileThumbnail from './file_thumbnail';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        enableSVGs: getConfig(state).EnableSVGs === 'true',
    };
}

export default connect(mapStateToProps)(FileThumbnail);
