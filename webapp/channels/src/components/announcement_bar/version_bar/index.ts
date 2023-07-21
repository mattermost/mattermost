// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {connect} from 'react-redux';

import VersionBar from './version_bar';

function mapStateToProps(state: GlobalState) {
    return {
        buildHash: state.entities.general.config.BuildHash,
    };
}

export default connect(mapStateToProps)(VersionBar);
