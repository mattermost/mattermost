// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const SettingItemMin = require('./setting_item_min.jsx');
const SettingItemMax = require('./setting_item_max.jsx');

const Client = require('../utils/client.jsx');
const Utils = require('../utils/utils.jsx');
import {strings} from '../utils/config.js';

export default class GeneralTab extends React.Component {
    constructor(props) {
        super(props);

        this.handleNameSubmit = this.handleNameSubmit.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.onUpdateSection = this.onUpdateSection.bind(this);
        this.updateName = this.updateName.bind(this);

        this.state = {name: this.props.teamDisplayName, serverError: '', clientError: ''};
    }
    handleNameSubmit(e) {
        e.preventDefault();

        let state = {serverError: '', clientError: ''};
        let valid = true;

        const name = this.state.name.trim();
        if (!name) {
            state.clientError = 'This field is required';
            valid = false;
        } else if (name === this.props.teamDisplayName) {
            state.clientError = 'Please choose a new name for your ' + strings.Team;
            valid = false;
        } else {
            state.clientError = '';
        }

        this.setState(state);

        if (!valid) {
            return;
        }

        let data = {};
        data.new_name = name;

        Client.updateTeamDisplayName(data,
            function nameChangeSuccess() {
                this.props.updateSection('');
                $('#team_settings').modal('hide');
                window.location.reload();
            }.bind(this),
            function nameChangeFail(err) {
                state.serverError = err.message;
                this.setState(state);
            }.bind(this)
        );
    }
    componentWillReceiveProps(newProps) {
        if (newProps.team && newProps.teamDisplayName) {
            this.setState({name: newProps.teamDisplayName});
        }
    }
    handleClose() {
        this.setState({clientError: '', serverError: ''});
        this.props.updateSection('');
    }
    componentDidMount() {
        $('#team_settings').on('hidden.bs.modal', this.handleClose);
    }
    componentWillUnmount() {
        $('#team_settings').off('hidden.bs.modal', this.handleClose);
    }
    onUpdateSection(e) {
        e.preventDefault();
        if (this.props.activeSection === 'name') {
            this.props.updateSection('');
        } else {
            this.props.updateSection('name');
        }
    }
    updateName(e) {
        e.preventDefault();
        this.setState({name: e.target.value});
    }
    render() {
        let clientError = null;
        let serverError = null;
        if (this.state.clientError) {
            clientError = this.state.clientError;
        }
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        let nameSection;

        if (this.props.activeSection === 'name') {
            let inputs = [];

            let teamNameLabel = Utils.toTitleCase(strings.Team) + ' Name';
            if (Utils.isMobile()) {
                teamNameLabel = '';
            }

            inputs.push(
                <div
                    key='teamNameSetting'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{teamNameLabel}</label>
                    <div className='col-sm-7'>
                        <input
                            className='form-control'
                            type='text'
                            onChange={this.updateName}
                            value={this.state.name}
                        />
                    </div>
                </div>
            );

            nameSection = (
                <SettingItemMax
                    title={`${Utils.toTitleCase(strings.Team)} Name`}
                    inputs={inputs}
                    submit={this.handleNameSubmit}
                    server_error={serverError}
                    client_error={clientError}
                    updateSection={this.onUpdateSection}
                />
            );
        } else {
            let describe = this.state.name;

            nameSection = (
                <SettingItemMin
                    title={`${Utils.toTitleCase(strings.Team)} Name`}
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
                        <i className='modal-back'></i>
                        General Settings
                    </h4>
                </div>
                <div
                    ref='wrapper'
                    className='user-settings'
                >
                    <h3 className='tab-header'>General Settings</h3>
                    <div className='divider-dark first'/>
                    {nameSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

GeneralTab.propTypes = {
    updateSection: React.PropTypes.func.isRequired,
    team: React.PropTypes.object.isRequired,
    activeSection: React.PropTypes.string.isRequired,
    teamDisplayName: React.PropTypes.string.isRequired
};
