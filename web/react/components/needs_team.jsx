// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as GlobalActions from '../action_creators/global_actions.jsx';

export default class NeedsTeam extends React.Component {
    componentWillMount() {
        GlobalActions.loadTeamRequiredPage();
    }
    render() {
        return this.props.children;
    }
}

NeedsTeam.defaultProps = {
};

NeedsTeam.propTypes = {
    children: React.PropTypes.object
};
