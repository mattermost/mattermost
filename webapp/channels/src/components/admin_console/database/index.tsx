// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getAppliedSchemaMigrations} from 'mattermost-redux/actions/admin';

import MigrationsTable from './migrations_table';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getAppliedSchemaMigrations,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(MigrationsTable);
