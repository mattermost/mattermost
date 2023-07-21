// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {connect} from 'react-redux';
import {RouteComponentProps} from 'react-router-dom';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {deleteScheme} from 'mattermost-redux/actions/schemes';
import {makeGetSchemeTeams} from 'mattermost-redux/selectors/entities/schemes';
import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import PermissionsSchemeSummary, {Props} from './permissions_scheme_summary';

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
