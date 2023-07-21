// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {getAppliedSchemaMigrations} from 'mattermost-redux/actions/admin';
import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import MigrationsTable from './migrations_table';

type Actions = {
    getAppliedSchemaMigrations: () => Promise<ActionResult>;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            getAppliedSchemaMigrations,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(MigrationsTable);
