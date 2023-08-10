// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {deleteScheme} from 'mattermost-redux/actions/schemes';
import {makeGetSchemeTeams} from 'mattermost-redux/selectors/entities/schemes';

import PermissionsSchemeSummary from './permissions_scheme_summary';

import type {Props} from './permissions_scheme_summary';
import type {GlobalState} from '@mattermost/types/store';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {RouteComponentProps} from 'react-router-dom';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

function makeMapStateToProps() {
    const getSchemeTeams = makeGetSchemeTeams();

    return function mapStateToProps(state: GlobalState, props: Props & RouteComponentProps) {
        return {
            teams: getSchemeTeams(state, {schemeId: props.scheme.id}),
        };
    };
}

type Actions = {
    deleteScheme: (schemeId: string) => Promise<ActionResult>;
};

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            deleteScheme,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(PermissionsSchemeSummary);
