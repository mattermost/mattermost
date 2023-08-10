// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import Pluggable from './pluggable';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        components: state.plugins.components,
        theme: getTheme(state),
    };
}

export default connect(mapStateToProps)(Pluggable);
