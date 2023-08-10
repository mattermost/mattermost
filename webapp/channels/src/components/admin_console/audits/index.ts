// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getAudits} from 'mattermost-redux/actions/admin';
import * as Selectors from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import Audits from './audits';

import type {Audit} from '@mattermost/types/audits';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {GlobalState} from 'types/store';

type Actions = {
    getAudits: () => Promise<{data: Audit[]}>;
}

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const isLicensed = license.Compliance === 'true';

    return {
        isLicensed,
        audits: Object.values(Selectors.getAudits(state)),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getAudits,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Audits);
