// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var TeamStore = require('../stores/team_store.jsx');
var ImportTab = require('./team_import_tab.jsx');
var FeatureTab = require('./team_feature_tab.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    displayName: 'Team Settings',
    propTypes: {
        activeTab: React.PropTypes.string.isRequired,
        activeSection: React.PropTypes.activeSection.isRequired,
        updateSection: React.PropTypes.func.isRequired
    },
    componentDidMount: function() {
        TeamStore.addChangeListener(this.onChange);
    },
    componentWillUnmount: function() {
        TeamStore.removeChangeListener(this.onChange);
    },
    onChange: function() {
        var team = TeamStore.getCurrent();
        if (!utils.areStatesEqual(this.state.team, team)) {
            this.setState({team: team});
        }
    },
    getInitialState: function() {
        return {team: TeamStore.getCurrent()};
    },
    render: function() {
        var result;
        switch (this.props.activeTab) {
            case 'general':
                result = (
                    <div>
                    </div>
                );
                break;
            case 'feature':
                result = (
                    <div>
                        <FeatureTab team={this.state.team} activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                    </div>
                );
                break;
            case 'import':
                result = (
                    <div>
                        <ImportTab team={this.state.team} activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
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
});
