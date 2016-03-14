// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TeamStore from '../stores/team_store.jsx';
import ImportTab from './team_import_tab.jsx';
import ExportTab from './team_export_tab.jsx';
import GeneralTab from './team_general_tab.jsx';
import * as Utils from '../utils/utils.jsx';

export default class TeamSettings extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);

        this.state = {team: TeamStore.getCurrent()};
    }
    componentDidMount() {
        TeamStore.addChangeListener(this.onChange);
    }
    componentWillUnmount() {
        TeamStore.removeChangeListener(this.onChange);
    }
    onChange() {
        var team = TeamStore.getCurrent();
        if (!Utils.areObjectsEqual(this.state.team, team)) {
            this.setState({team});
        }
    }
    render() {
        if (!this.state.team) {
            return null;
        }
        var result;
        switch (this.props.activeTab) {
        case 'general':
            result = (
                <div>
                    <GeneralTab
                        team={this.state.team}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                    />
                </div>
            );
            break;
        case 'import':
            result = (
                <div>
                    <ImportTab
                        team={this.state.team}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                    />
                </div>
            );
            break;
        case 'export':
            result = (
                <div>
                    <ExportTab/>
                </div>
            );
            break;
        default:
            result = (
                <div/>
            );
            break;
        }
        return result;
    }
}

TeamSettings.defaultProps = {
    activeTab: '',
    activeSection: ''
};

TeamSettings.propTypes = {
    activeTab: React.PropTypes.string.isRequired,
    activeSection: React.PropTypes.string.isRequired,
    updateSection: React.PropTypes.func.isRequired
};
