// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, ActionCreatorsMapObject, Dispatch} from 'redux';

import {addCommand} from 'mattermost-redux/actions/integrations';
import {ActionFunc} from 'mattermost-redux/types/actions';

import AddCommand, {Props} from './add_command';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            addCommand,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(AddCommand);
