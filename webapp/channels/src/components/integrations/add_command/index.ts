// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {addCommand} from 'mattermost-redux/actions/integrations';

import AddCommand from './add_command';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addCommand,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(AddCommand);
