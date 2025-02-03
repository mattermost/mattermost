// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, type ConnectedProps} from 'react-redux';

import {getTeams, searchTeams} from 'mattermost-redux/actions/teams';

import TeamFilterDropdown from './team_filter_dropdown';

const mapDispatchToProps = {
    searchTeams,
    getTeams,
};

const connector = connect(null, mapDispatchToProps);
export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(TeamFilterDropdown);
