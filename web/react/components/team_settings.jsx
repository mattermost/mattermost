// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var TeamStore = require('../stores/team_store.jsx');
var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');
var SettingPicture = require('./setting_picture.jsx');
var utils = require('../utils/utils.jsx');

var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var Constants = require('../utils/constants.jsx');

var FeatureTab = React.createClass({
    submitValetFeature: function() {
        data = {};
        data['allow_valet'] = this.state.allow_valet;

        client.updateValetFeature(data,
            function(data) {
                this.props.updateSection("");
                AsyncClient.getMyTeam();
            }.bind(this),
            function(err) {
                state = this.getInitialState();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    handleValetRadio: function(val) {
        this.setState({ allow_valet: val });
        this.refs.wrapper.getDOMNode().focus();
    },
    componentWillReceiveProps: function(newProps) {
        var team = newProps.team;

        var allow_valet = "false";
        if (team && team.allow_valet) {
            allow_valet = "true";
        }

        this.setState({ allow_valet: allow_valet });
    },
    getInitialState: function() {
        var team = this.props.team;

        var allow_valet = "false";
        if (team && team.allow_valet) {
            allow_valet = "true";
        }

        return { allow_valet: allow_valet };
    },
    render: function() {
        var team = this.props.team;

        var client_error = this.state.client_error ? this.state.client_error : null;
        var server_error = this.state.server_error ? this.state.server_error : null;

        var valetSection;
        var self = this;

        if (this.props.activeSection === 'valet') {
            var valetActive = ["",""];
            if (this.state.allow_valet === "false") {
                valetActive[1] = "active";
            } else {
                valetActive[0] = "active";
            }

            var inputs = [];

            inputs.push(
                <div className="col-sm-12">
                    <div className="btn-group" data-toggle="buttons-radio">
                        <button className={"btn btn-default "+valetActive[0]} onClick={function(){self.handleValetRadio("true")}}>On</button>
                        <button className={"btn btn-default "+valetActive[1]} onClick={function(){self.handleValetRadio("false")}}>Off</button>
                    </div>
                    <div><br/>Warning: Turning on the Valet feature and using it with any third party software increases the risk of a security breach.</div>
                </div>
            );

            valetSection = (
                <SettingItemMax
                    title="Valet"
                    inputs={inputs}
                    submit={this.submitValetFeature}
                    server_error={server_error}
                    client_error={client_error}
                    updateSection={function(e){self.props.updateSection("");e.preventDefault();}}
                />
            );
        } else {
            var describe = "";
            if (this.state.allow_valet === "false") {
                describe = "Off";
            } else {
                describe = "On";
            }

            valetSection = (
                <SettingItemMin
                    title="Valet"
                    describe={describe}
                    updateSection={function(){self.props.updateSection("valet");}}
                />
            );
        }

        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>General Settings</h4>
                </div>
                <div ref="wrapper" className="user-settings">
                    <h3 className="tab-header">Feature Settings</h3>
                    <div className="divider-dark first"/>
                    {valetSection}
                    <div className="divider-dark"/>
                </div>
            </div>
        );
    }
});

module.exports = React.createClass({
    componentDidMount: function() {
        TeamStore.addChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        TeamStore.removeChangeListener(this._onChange);
    },
    _onChange: function () {
        var team = TeamStore.getCurrent();
        if (!utils.areStatesEqual(this.state.team, team)) {
            this.setState({ team: team });
        }
    },
    getInitialState: function() {
        return { team: TeamStore.getCurrent() };
    },
    render: function() {
        if (this.props.activeTab === 'general') {
            return (
                <div>
                </div>
            );
        } else if (this.props.activeTab === 'feature') {
            return (
                <div>
                    <FeatureTab team={this.state.team} activeSection={this.props.activeSection} updateSection={this.props.updateSection} />
                </div>
            );
        } else {
            return <div/>;
        }
    }
});
