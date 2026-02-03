// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {RouteComponentProps} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {deleteScheme} from 'mattermost-redux/actions/schemes';
import {makeGetSchemeTeams} from 'mattermost-redux/selectors/entities/schemes';

import PermissionsSchemeSummary from './permissions_scheme_summary';
import type {Props} from './permissions_scheme_summary';

function makeMapStateToProps() {
    const getSchemeTeams = makeGetSchemeTeams();

    return function mapStateToProps(state: GlobalState, props: Props & RouteComponentProps) {
        return {
            teams: getSchemeTeams(state, {schemeId: props.scheme.id}),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            deleteScheme,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PermissionsSchemeSummary);
