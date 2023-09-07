// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import EmbeddedBinding from './embedded_binding';

function mapStateToProps(state: GlobalState) {
    return {
        currentRelativeTeamUrl: getCurrentRelativeTeamUrl(state),
    };
}

export default connect(mapStateToProps)(EmbeddedBinding);
