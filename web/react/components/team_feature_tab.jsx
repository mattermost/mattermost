// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');

var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');

module.exports = React.createClass({
    displayName: 'Feature Tab',
    propTypes: {
        updateSection: React.PropTypes.func.isRequired,
        team: React.PropTypes.object.isRequired,
        activeSection: React.PropTypes.string.isRequired
    },
    submitValetFeature: function() {
        var data = {};
        data.allowValet = this.state.allowValet;

        client.updateValetFeature(data,
            function() {
                this.props.updateSection('');
                AsyncClient.getMyTeam();
            }.bind(this),
            function(err) {
                var state = this.getInitialState();
                state.serverError = err;
                this.setState(state);
            }.bind(this)
        );
    },
    handleValetRadio: function(val) {
        this.setState({allowValet: val});
        this.refs.wrapper.getDOMNode().focus();
    },
    componentWillReceiveProps: function(newProps) {
        var team = newProps.team;

        var allowValet = 'false';
        if (team && team.allowValet) {
            allowValet = 'true';
        }

        this.setState({allowValet: allowValet});
    },
    getInitialState: function() {
        var team = this.props.team;

        var allowValet = 'false';
        if (team && team.allowValet) {
            allowValet = 'true';
        }

        return {allowValet: allowValet};
    },
    onUpdateSection: function() {
        if (this.props.activeSection === 'valet') {
            self.props.updateSection('valet');
        } else {
            self.props.updateSection('');
        }
    },
    render: function() {
        var clientError = null;
        var serverError = null;
        if (this.state.clientError) {
            clientError = this.state.clientError;
        }
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        var valetSection;
        var self = this;

        if (this.props.activeSection === 'valet') {
            var valetActive = ['', ''];
            if (this.state.allowValet === 'false') {
                valetActive[1] = 'active';
            } else {
                valetActive[0] = 'active';
            }

            var inputs = [];

            function valetActivate() {
                self.handleValetRadio('true');
            }

            function valetDeactivate() {
                self.handleValetRadio('false');
            }

            inputs.push(
                <div>
                    <div className='btn-group' data-toggle='buttons-radio'>
                        <button className={'btn btn-default ' + valetActive[0]} onClick={valetActivate}>On</button>
                        <button className={'btn btn-default ' + valetActive[1]} onClick={valetDeactivate}>Off</button>
                    </div>
                    <div><br/>Valet is a preview feature for enabling a non-user account limited to basic member permissions that can be manipulated by 3rd parties.<br/><br/>IMPORTANT: The preview version of Valet should not be used without a secure connection and a trusted 3rd party, since user credentials are used to connect. OAuth2 will be used in the final release.</div>
                </div>
            );

            valetSection = (
                <SettingItemMax
                    title='Valet (Preview - EXPERTS ONLY)'
                    inputs={inputs}
                    submit={this.submitValetFeature}
                    serverError={serverError}
                    clientError={clientError}
                    updateSection={this.onUpdateSection}
                />
            );
        } else {
            var describe = '';
            if (this.state.allowValet === 'false') {
                describe = 'Off';
            } else {
                describe = 'On';
            }

            valetSection = (
                <SettingItemMin
                    title='Valet (Preview - EXPERTS ONLY)'
                    describe={describe}
                    updateSection={this.onUpdateSection}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button type='button' className='close' data-dismiss='modal' aria-label='Close'><span aria-hidden='true'>&times;</span></button>
                    <h4 className='modal-title' ref='title'><i className='modal-back'></i>Feature Settings</h4>
                </div>
                <div ref='wrapper' className='user-settings'>
                    <h3 className='tab-header'>Feature Settings</h3>
                    <div className='divider-dark first'/>
                    {valetSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
});
