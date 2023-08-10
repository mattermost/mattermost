// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import FilePreview from './file_preview';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        enableSVGs: config.EnableSVGs === 'true',
    };
}

export default connect(mapStateToProps)(FilePreview);
