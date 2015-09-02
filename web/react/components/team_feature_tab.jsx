// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');

var Client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');

export default class FeatureTab extends React.Component {
    constructor(props) {
        super(props);

        this.submitValetFeature = this.submitValetFeature.bind(this);
        this.handleValetRadio = this.handleValetRadio.bind(this);
        this.onUpdateSection = this.onUpdateSection.bind(this);
        this.setupInitialState = this.setupInitialState.bind(this);

        this.state = this.setupInitialState();
    }
    componentWillReceiveProps(newProps) {
        var team = newProps.team;

        var allowValet = 'false';
        if (team && team.allow_valet) {
            allowValet = 'true';
        }

        this.setState({allowValet: allowValet});
    }
    submitValetFeature() {
        var data = {};
        data.allow_valet = this.state.allowValet;

        Client.updateValetFeature(data,
            function success() {
                this.props.updateSection('');
                AsyncClient.getMyTeam();
            }.bind(this),
            function fail(err) {
                var state = this.setupInitialState();
                state.serverError = err;
                this.setState(state);
            }.bind(this)
        );
    }
    handleValetRadio(val) {
        this.setState({allowValet: val});
        React.findDOMNode(this.refs.wrapper).focus();
    }
    onUpdateSection(e) {
        e.preventDefault();
        if (this.props.activeSection === 'valet') {
            this.props.updateSection('');
        } else {
            this.props.updateSection('valet');
        }
    }
    setupInitialState() {
        var allowValet;
        var team = this.props.team;

        if (team && team.allow_valet) {
            allowValet = 'true';
        } else {
            allowValet = 'false';
        }

        return {allowValet: allowValet};
    }
    render() {
        var clientError = null;
        var serverError = null;
        if (this.state.clientError) {
            clientError = this.state.clientError;
        }
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        var valetSection;

        if (this.props.activeSection === 'valet') {
            var valetActive = [false, false];
            if (this.state.allowValet === 'false') {
                valetActive[1] = true;
            } else {
                valetActive[0] = true;
            }

            let inputs = [];

            inputs.push(
                <div key='teamValetSetting'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={valetActive[0]}
                                onChange={this.handleValetRadio.bind(this, 'true')}
                            >
                                On
                            </input>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={valetActive[1]}
                                onChange={this.handleValetRadio.bind(this, 'false')}
                            >
                                Off
                            </input>
                        </label>
                        <br/>
                     </div>
                     <div><br/>Valet is a preview feature for enabling a non-user account limited to basic member permissions that can be manipulated by 3rd parties.<br/><br/>IMPORTANT: The preview version of Valet should not be used without a secure connection and a trusted 3rd party, since user credentials are used to connect. OAuth2 will be used in the final release.</div>
                 </div>
            );

            valetSection = (
                <SettingItemMax
                    title='Valet (Preview - EXPERTS ONLY)'
                    inputs={inputs}
                    submit={this.submitValetFeature}
                    server_error={serverError}
                    client_error={clientError}
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
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        <span aria-hidden='true'>&times;</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>Advanced Features
                    </h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
                    <h3 className='tab-header'>Advanced Features</h3>
                    <div className='divider-dark first'/>
                    {valetSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

FeatureTab.defaultProps = {
    team: {},
    activeSection: ''
};
FeatureTab.propTypes = {
    updateSection: React.PropTypes.func.isRequired,
    team: React.PropTypes.object.isRequired,
    activeSection: React.PropTypes.string.isRequired
};
