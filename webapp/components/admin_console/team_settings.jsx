// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import Client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const holders = defineMessages({
    siteNameExample: {
        id: 'admin.team.siteNameExample',
        defaultMessage: 'Ex "Mattermost"'
    },
    maxUsersExample: {
        id: 'admin.team.maxUsersExample',
        defaultMessage: 'Ex "25"'
    },
    restrictExample: {
        id: 'admin.team.restrictExample',
        defaultMessage: 'Ex "corp.mattermost.com, mattermost.org"'
    },
    saving: {
        id: 'admin.team.saving',
        defaultMessage: 'Saving Config...'
    }
});

import React from 'react';

const ENABLE_BRAND_ACTION = 'enable_brand_action';
const DISABLE_BRAND_ACTION = 'disable_brand_action';

class TeamSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleImageChange = this.handleImageChange.bind(this);
        this.handleImageSubmit = this.handleImageSubmit.bind(this);

        this.uploading = false;
        this.timestamp = 0;

        this.state = {
            saveNeeded: false,
            brandImageExists: false,
            enableCustomBrand: this.props.config.TeamSettings.EnableCustomBrand,
            serverError: null
        };
    }

    componentWillMount() {
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.CustomBrand === 'true') {
            $.get(Client.getAdminRoute() + '/get_brand_image').done(() => this.setState({brandImageExists: true}));
        }
    }

    componentDidUpdate() {
        if (this.refs.image) {
            const reader = new FileReader();

            const img = this.refs.image;
            reader.onload = (e) => {
                $(img).attr('src', e.target.result);
            };

            reader.readAsDataURL(this.state.brandImage);
        }
    }

    handleChange(action) {
        var s = {saveNeeded: true};

        if (action === ENABLE_BRAND_ACTION) {
            s.enableCustomBrand = true;
        }

        if (action === DISABLE_BRAND_ACTION) {
            s.enableCustomBrand = false;
        }

        this.setState(s);
    }

    handleImageChange() {
        const element = $(this.refs.fileInput);
        if (element.prop('files').length > 0) {
            this.setState({fileSelected: true, brandImage: element.prop('files')[0]});
        }
        $('#upload-button').button('reset');
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.TeamSettings.SiteName = this.refs.SiteName.value.trim();
        config.TeamSettings.RestrictCreationToDomains = this.refs.RestrictCreationToDomains.value.trim();
        config.TeamSettings.EnableTeamCreation = this.refs.EnableTeamCreation.checked;
        config.TeamSettings.EnableUserCreation = this.refs.EnableUserCreation.checked;
        config.TeamSettings.EnableOpenServer = this.refs.EnableOpenServer.checked;
        config.TeamSettings.RestrictTeamNames = this.refs.RestrictTeamNames.checked;

        if (this.refs.EnableCustomBrand) {
            config.TeamSettings.EnableCustomBrand = this.refs.EnableCustomBrand.checked;
        }

        if (this.refs.CustomBrandText) {
            config.TeamSettings.CustomBrandText = this.refs.CustomBrandText.value;
        }

        var MaxUsersPerTeam = 50;
        if (!isNaN(parseInt(this.refs.MaxUsersPerTeam.value, 10))) {
            MaxUsersPerTeam = parseInt(this.refs.MaxUsersPerTeam.value, 10);
        }
        config.TeamSettings.MaxUsersPerTeam = MaxUsersPerTeam;
        this.refs.MaxUsersPerTeam.value = MaxUsersPerTeam;

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

    handleImageSubmit(e) {
        e.preventDefault();

        if (!this.state.brandImage) {
            return;
        }

        if (this.uploading) {
            return;
        }

        $('#upload-button').button('loading');
        this.uploading = true;

        Client.uploadBrandImage(this.state.brandImage,
            () => {
                $('#upload-button').button('complete');
                this.timestamp = Utils.getTimestamp();
                this.setState({brandImageExists: true, brandImage: null});
                this.uploading = false;
            },
            (err) => {
                $('#upload-button').button('reset');
                this.uploading = false;
                this.setState({serverImageError: err.message});
            }
        );
    }

    createBrandSettings() {
        var btnClass = 'btn';
        if (this.state.fileSelected) {
            btnClass = 'btn btn-primary';
        }

        var serverImageError = '';
        if (this.state.serverImageError) {
            serverImageError = <div className='form-group has-error'><label className='control-label'>{this.state.serverImageError}</label></div>;
        }

        let uploadImage;
        let uploadText;
        if (this.state.enableCustomBrand) {
            let img;
            if (this.state.brandImage) {
                img = (
                    <img
                        ref='image'
                        className='brand-img'
                        src=''
                    />
                );
            } else if (this.state.brandImageExists) {
                img = (
                    <img
                        className='brand-img'
                        src={Client.getAdminRoute() + '/get_brand_image?t=' + this.timestamp}
                    />
                );
            } else {
                img = (
                    <p>
                        <FormattedMessage
                            id='admin.team.noBrandImage'
                            defaultMessage='No brand image uploaded'
                        />
                    </p>
                );
            }

            uploadImage = (
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='CustomBrandImage'
                    >
                        <FormattedMessage
                            id='admin.team.brandImageTitle'
                            defaultMessage='Custom Brand Image:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        {img}
                    </div>
                    <div className='col-sm-4'/>
                    <div className='col-sm-8'>
                        <div className='file__upload'>
                            <button className='btn btn-default'>
                                <FormattedMessage
                                    id='admin.team.chooseImage'
                                    defaultMessage='Choose New Image'
                                />
                            </button>
                            <input
                                ref='fileInput'
                                type='file'
                                accept='.jpg,.png,.bmp'
                                onChange={this.handleImageChange}
                            />
                        </div>
                        <button
                            className={btnClass}
                            disabled={!this.state.fileSelected}
                            onClick={this.handleImageSubmit}
                            id='upload-button'
                            data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + Utils.localizeMessage('admin.team.uploading', 'Uploading..')}
                            data-complete-text={'<span class=\'glyphicon glyphicon-ok\'></span> ' + Utils.localizeMessage('admin.team.uploaded', 'Uploaded!')}
                        >
                            <FormattedMessage
                                id='admin.team.upload'
                                defaultMessage='Upload'
                            />
                        </button>
                        <br/>
                        {serverImageError}
                        <p className='help-text no-margin'>
                            <FormattedHTMLMessage
                                id='admin.team.uploadDesc'
                                defaultMessage='Customize your user experience by adding a custom image to your login screen. See examples at <a href="http://docs.mattermost.com/administration/config-settings.html#custom-branding" target="_blank">docs.mattermost.com/administration/config-settings.html#custom-branding</a>.'
                            />
                        </p>
                    </div>
                </div>
            );

            uploadText = (
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='CustomBrandText'
                    >
                        <FormattedMessage
                            id='admin.team.brandTextTitle'
                            defaultMessage='Custom Brand Text:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        <textarea
                            type='text'
                            rows='5'
                            maxLength='1024'
                            className='form-control admin-textarea'
                            id='CustomBrandText'
                            ref='CustomBrandText'
                            onChange={this.handleChange}
                        >
                            {this.props.config.TeamSettings.CustomBrandText}
                        </textarea>
                        <p className='help-text'>
                            <FormattedMessage
                                id='admin.team.brandTextDescription'
                                defaultMessage='The custom branding Markdown-formatted text you would like to appear below your custom brand image on your login sreen.'
                            />
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div>
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='EnableCustomBrand'
                    >
                        <FormattedMessage
                            id='admin.team.brandTitle'
                            defaultMessage='Enable Custom Branding: '
                        />
                    </label>
                    <div className='col-sm-8'>
                        <label className='radio-inline'>
                            <input
                                type='radio'
                                name='EnableCustomBrand'
                                value='true'
                                ref='EnableCustomBrand'
                                defaultChecked={this.props.config.TeamSettings.EnableCustomBrand}
                                onChange={this.handleChange.bind(this, ENABLE_BRAND_ACTION)}
                            />
                            <FormattedMessage
                                id='admin.team.true'
                                defaultMessage='true'
                            />
                        </label>
                        <label className='radio-inline'>
                            <input
                                type='radio'
                                name='EnableCustomBrand'
                                value='false'
                                defaultChecked={!this.props.config.TeamSettings.EnableCustomBrand}
                                onChange={this.handleChange.bind(this, DISABLE_BRAND_ACTION)}
                            />
                            <FormattedMessage
                                id='admin.team.false'
                                defaultMessage='false'
                            />
                        </label>
                        <p className='help-text'>
                            <FormattedMessage
                                id='admin.team.brandDesc'
                                defaultMessage='Enable custom branding to show an image of your choice, uploaded below, and some help text, written below, on the login page.'
                            />
                        </p>
                    </div>
                </div>

                {uploadImage}
                {uploadText}
            </div>
        );
    }

    render() {
        const {formatMessage} = this.props.intl;
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass = 'btn btn-primary';
        }

        let brand;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.CustomBrand === 'true') {
            brand = this.createBrandSettings();
        }

        return (
            <div className='wrapper--fixed'>

                <h3>
                    <FormattedMessage
                        id='admin.team.title'
                        defaultMessage='Team Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SiteName'
                        >
                            <FormattedMessage
                                id='admin.team.siteNameTitle'
                                defaultMessage='Site Name:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SiteName'
                                ref='SiteName'
                                placeholder={formatMessage(holders.siteNameExample)}
                                defaultValue={this.props.config.TeamSettings.SiteName}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.team.siteNameDescription'
                                    defaultMessage='Name of service shown in login screens and UI.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaxUsersPerTeam'
                        >
                            <FormattedMessage
                                id='admin.team.maxUsersTitle'
                                defaultMessage='Max Users Per Team:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaxUsersPerTeam'
                                ref='MaxUsersPerTeam'
                                placeholder={formatMessage(holders.maxUsersExample)}
                                defaultValue={this.props.config.TeamSettings.MaxUsersPerTeam}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.team.maxUsersDescription'
                                    defaultMessage='Maximum total number of users per team, including both active and inactive users.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableTeamCreation'
                        >
                            <FormattedMessage
                                id='admin.team.teamCreationTitle'
                                defaultMessage='Enable Team Creation: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTeamCreation'
                                    value='true'
                                    ref='EnableTeamCreation'
                                    defaultChecked={this.props.config.TeamSettings.EnableTeamCreation}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.team.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTeamCreation'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.EnableTeamCreation}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.team.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.team.teamCreationDescription'
                                    defaultMessage='When false, the ability to create teams is disabled. The create team button displays error when pressed.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableUserCreation'
                        >
                            <FormattedMessage
                                id='admin.team.userCreationTitle'
                                defaultMessage='Enable User Creation: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableUserCreation'
                                    value='true'
                                    ref='EnableUserCreation'
                                    defaultChecked={this.props.config.TeamSettings.EnableUserCreation}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.team.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableUserCreation'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.EnableUserCreation}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.team.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.team.userCreationDescription'
                                    defaultMessage='When false, the ability to create accounts is disabled. The create account button displays error when pressed.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableOpenServer'
                        >
                            <FormattedMessage
                                id='admin.team.openServerTitle'
                                defaultMessage='Enable Open Server: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableOpenServer'
                                    value='true'
                                    ref='EnableOpenServer'
                                    defaultChecked={this.props.config.TeamSettings.EnableOpenServer}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.team.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableOpenServer'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.EnableOpenServer}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.team.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.team.openServerDescription'
                                    defaultMessage='When true, anyone can signup for a user account on this server without the need to be invited.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='RestrictCreationToDomains'
                        >
                            <FormattedMessage
                                id='admin.team.restrictTitle'
                                defaultMessage='Restrict Creation To Domains:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='RestrictCreationToDomains'
                                ref='RestrictCreationToDomains'
                                placeholder={formatMessage(holders.restrictExample)}
                                defaultValue={this.props.config.TeamSettings.RestrictCreationToDomains}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.team.restrictDescription'
                                    defaultMessage='Teams and user accounts can only be created from a specific domain (e.g. "mattermost.org") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.org").'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='RestrictTeamNames'
                        >
                            <FormattedMessage
                                id='admin.team.restrictNameTitle'
                                defaultMessage='Restrict Team Names: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='RestrictTeamNames'
                                    value='true'
                                    ref='RestrictTeamNames'
                                    defaultChecked={this.props.config.TeamSettings.RestrictTeamNames}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.team.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='RestrictTeamNames'
                                    value='false'
                                    defaultChecked={!this.props.config.TeamSettings.RestrictTeamNames}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.team.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.team.restrictNameDesc'
                                    defaultMessage='When true, You cannot create a team name with reserved words like www, admin, support, test, channel, etc'
                                />
                            </p>
                        </div>
                    </div>

                    {brand}

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            {serverError}
                            <button
                                disabled={!this.state.saveNeeded}
                                type='submit'
                                className={saveClass}
                                onClick={this.handleSubmit}
                                id='save-button'
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(holders.saving)}
                            >
                                <FormattedMessage
                                    id='admin.team.save'
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

TeamSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(TeamSettings);
