// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getAudits} from 'mattermost-redux/actions/admin';
import * as Selectors from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import Audits from './audits';

function mapStateToProps(state: GlobalState) {
    const license = getLicense(state);
    const isLicensed = license.Compliance === 'true';

    return {
        isLicensed,
        audits: Object.values(Selectors.getAudits(state)),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getAudits,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Audits);
