// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import * as Client from '../../utils/web_client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import * as Utils from '../../utils/utils.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import React from 'react';
import ReactDOM from 'react-dom';

export default class ComplianceSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleEnable = this.handleEnable.bind(this);
        this.handleDisable = this.handleDisable.bind(this);

        this.state = {
            saveNeeded: false,
            serverError: null,
            enable: this.props.config.ComplianceSettings.Enable
        };
    }
    handleChange() {
        this.setState({saveNeeded: true});
    }
    handleEnable() {
        this.setState({saveNeeded: true, enable: true});
    }
    handleDisable() {
        this.setState({saveNeeded: true, enable: false});
    }
    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        const config = this.props.config;
        config.ComplianceSettings.Enable = this.refs.Enable.checked;
        config.ComplianceSettings.Directory = ReactDOM.findDOMNode(this.refs.Directory).value;
        config.ComplianceSettings.EnableDaily = this.refs.EnableDaily.checked;

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig();
                this.setState({
                    serverError: null,
                    saveNeeded: false
                });
                $('#save-button').button('reset');
            },
            (err) => {
                this.setState({
                    serverError: err.message,
                    saveNeeded: true
                });
                $('#save-button').button('reset');
            }
        );
    }
    render() {
        let serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        let saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass = 'btn btn-primary';
        }

        const licenseEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.Compliance === 'true';

        let bannerContent;
        if (!licenseEnabled) {
            bannerContent = (
                <div className='banner warning'>
                    <div className='banner__content'>
                        <FormattedHTMLMessage
                            id='admin.compliance.noLicense'
                            defaultMessage='<h4 class="banner__heading">Note:</h4><p>Compliance is an enterprise feature. Your current license does not support Compliance. Click <a href="http://mattermost.com"target="_blank">here</a> for information and pricing on enterprise licenses.</p>'
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                {bannerContent}
                <h3>
                    <FormattedMessage
                        id='admin.compliance.title'
                        defaultMessage='Compliance Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Enable'
                        >
                            <FormattedMessage
                                id='admin.compliance.enableTitle'
                                defaultMessage='Enable Compliance:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='true'
                                    ref='Enable'
                                    defaultChecked={this.props.config.ComplianceSettings.Enable}
                                    onChange={this.handleEnable}
                                    disabled={!licenseEnabled}
                                />
                                <FormattedMessage
                                    id='admin.compliance.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='false'
                                    defaultChecked={!this.props.config.ComplianceSettings.Enable}
                                    onChange={this.handleDisable}
                                />
                                <FormattedMessage
                                    id='admin.compliance.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.compliance.enableDesc'
                                    defaultMessage='When true, Mattermost allows compliance reporting'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Directory'
                        >
                            <FormattedMessage
                                id='admin.compliance.directoryTitle'
                                defaultMessage='Compliance Directory Location:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='Directory'
                                ref='Directory'
                                placeholder={Utils.localizeMessage('admin.compliance.directoryExample', 'Ex "./data/"')}
                                defaultValue={this.props.config.ComplianceSettings.Directory}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.compliance.directoryDescription'
                                    defaultMessage='Directory to which compliance reports are written. If blank, will be set to ./data/.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableDaily'
                        >
                            <FormattedMessage
                                id='admin.compliance.enableDailyTitle'
                                defaultMessage='Enable Daily Report:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableDaily'
                                    value='true'
                                    ref='EnableDaily'
                                    defaultChecked={this.props.config.ComplianceSettings.EnableDaily}
                                    onChange={this.handleChange}
                                    disabled={!this.state.enable}
                                />
                                <FormattedMessage
                                    id='admin.compliance.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableDaily'
                                    value='false'
                                    defaultChecked={!this.props.config.ComplianceSettings.EnableDaily}
                                    disabled={!this.state.enable}
                                />
                                <FormattedMessage
                                    id='admin.compliance.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.compliance.enableDailyDesc'
                                    defaultMessage='When true, Mattermost will generate a daily compliance report.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            {serverError}
                            <button
                                disabled={!this.state.saveNeeded}
                                type='submit'
                                className={saveClass}
                                onClick={this.handleSubmit}
                                id='save-button'
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + Utils.localizeMessage('admin.compliance.saving', 'Saving Config...')}
                            >
                                <FormattedMessage
                                    id='admin.compliance.save'
                                    defaultMessage='Save'
                                />
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}

ComplianceSettings.propTypes = {
    config: React.PropTypes.object
};

