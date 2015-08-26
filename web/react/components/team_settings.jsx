// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var TeamStore = require('../stores/team_store.jsx');
var ImportTab = require('./team_import_tab.jsx');
var ExportTab = require('./team_export_tab.jsx');
var FeatureTab = require('./team_feature_tab.jsx');
var GeneralTab = require('./team_general_tab.jsx');
var Utils = require('../utils/utils.jsx');

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
        if (!Utils.areStatesEqual(this.state.team, team)) {
            this.setState({team: team});
        }
    }
    render() {
        var result;
        switch (this.props.activeTab) {
        case 'general':
            result = (
                <div>
                    <GeneralTab
                        team={this.state.team}
                        activeSection={this.props.activeSection}
                        updateSection={this.props.updateSection}
                        teamDisplayName={this.props.teamDisplayName}
                    />
                </div>
            );
            break;
        case 'feature':
            result = (
                <div>
                    <FeatureTab
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
                    <ExportTab />
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
    activeSection: '',
    teamDisplayName: ''
};
TeamSettings.propTypes = {
    activeTab: React.PropTypes.string.isRequired,
    activeSection: React.PropTypes.string.isRequired,
    updateSection: React.PropTypes.func.isRequired,
    teamDisplayName: React.PropTypes.string.isRequired
};
