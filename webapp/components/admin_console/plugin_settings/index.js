// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {uploadPlugin, removePlugin, getPlugins} from 'mattermost-redux/actions/admin';

import PluginSettings from './plugin_settings.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        plugins: state.entities.admin.plugins
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            uploadPlugin,
            removePlugin,
            getPlugins
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(PluginSettings);
