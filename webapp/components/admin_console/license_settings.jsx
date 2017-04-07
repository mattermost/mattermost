// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';

import {uploadLicenseFile, removeLicenseFile} from 'actions/admin_actions.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const holders = defineMessages({
    removing: {
        id: 'admin.license.removing',
        defaultMessage: 'Removing License...'
    },
    uploading: {
        id: 'admin.license.uploading',
        defaultMessage: 'Uploading License...'
    }
});

import React from 'react';

class LicenseSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleRemove = this.handleRemove.bind(this);

        this.state = {
            fileSelected: false,
            fileName: null,
            serverError: null
        };
    }

    handleChange() {
        const element = $(ReactDOM.findDOMNode(this.refs.fileInput));
        if (element.prop('files').length > 0) {
            this.setState({fileSelected: true, fileName: element.prop('files')[0].name});
        }
    }

    handleSubmit(e) {
        e.preventDefault();

        const element = $(ReactDOM.findDOMNode(this.refs.fileInput));
        if (element.prop('files').length === 0) {
            return;
        }
        const file = element.prop('files')[0];

        $('#upload-button').button('loading');

        uploadLicenseFile(
            file,
            () => {
                Utils.clearFileInput(element[0]);
                $('#upload-button').button('reset');
                this.setState({fileSelected: false, fileName: null, serverError: null});
                window.location.reload(true);
            },
            (error) => {
                Utils.clearFileInput(element[0]);
                $('#upload-button').button('reset');
                this.setState({fileSelected: false, fileName: null, serverError: error.message});
            }
        );
    }

    handleRemove(e) {
        e.preventDefault();

        $('#remove-button').button('loading');

        removeLicenseFile(
            () => {
                $('#remove-button').button('reset');
                this.setState({fileSelected: false, fileName: null, serverError: null});
                window.location.reload(true);
            },
            (error) => {
                $('#remove-button').button('reset');
                this.setState({fileSelected: false, fileName: null, serverError: error.message});
            }
        );
    }

    render() {
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='col-sm-12'><div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div></div>;
        }

        var btnClass = 'btn';
        if (this.state.fileSelected) {
            btnClass = 'btn btn-primary';
        }

        let edition;
        let licenseType;
        let licenseKey;

        const issued = Utils.displayDate(parseInt(global.window.mm_license.IssuedAt, 10)) + ' ' + Utils.displayTime(parseInt(global.window.mm_license.IssuedAt, 10), true);
        const startsAt = Utils.displayDate(parseInt(global.window.mm_license.StartsAt, 10));
        const expiresAt = Utils.displayDate(parseInt(global.window.mm_license.ExpiresAt, 10));

        if (global.window.mm_license.IsLicensed === 'true') {
            // Note: DO NOT LOCALISE THESE STRINGS. Legally we can not since the license is in English.
            edition = 'Mattermost Enterprise Edition. Enterprise features on this server have been unlocked with a license key and a valid subscription.';
            licenseType = (
                <div>
                    <p>
                        {'This software is offered under a commercial license.\n\nSee ENTERPRISE-EDITION-LICENSE.txt in your root install directory for details. See NOTICE.txt for information about open source software used in this system.\n\nYour subscription details are as follows:'}
                    </p>
                    {`Name: ${global.window.mm_license.Name}`}<br/>
                    {`Company or organization name: ${global.window.mm_license.Company}`}<br/>
                    {`Number of users: ${global.window.mm_license.Users}`}<br/>
                    {`License issued: ${issued}`}<br/>
                    {`Start date of license: ${startsAt}`}<br/>
                    {`Expiry date of license: ${expiresAt}`}<br/>
                    <br/>
                    {'See also '}<a href='https://about.mattermost.com/enterprise-edition-terms/'>{'Enterprise Edition Terms of Service'}</a>{' and '}<a href='https://about.mattermost.com/privacy/'>{'Privacy Policy.'}</a>
                </div>
            );

            licenseKey = (
                <div className='col-sm-8'>
                    <button
                        className='btn btn-danger'
                        onClick={this.handleRemove}
                        id='remove-button'
                        data-loading-text={'<span class=\'fa fa-refresh icon--rotate\'></span> ' + this.props.intl.formatMessage(holders.removing)}
                    >
                        <FormattedMessage
                            id='admin.license.keyRemove'
                            defaultMessage='Remove Enterprise License and Downgrade Server'
                        />
                    </button>
                    <br/>
                    <br/>
                    <p className='help-text'>
                        {'If you migrate servers you may need to remove your license key to install it elsewhere. You can remove the key here, which will revert functionality to that of Team Edition.'}
                    </p>
                </div>
            );
        } else {
            // Note: DO NOT LOCALISE THESE STRINGS. Legally we can not since the license is in English.
            edition = (
                <p>
                    {'Mattermost Enterprise Edition. Unlock enterprise features in this software through the purchase of a subscription from '}
                    <a
                        target='_blank'
                        rel='noopener noreferrer'
                        href='https://mattermost.com/'
                    >
                        {'https://mattermost.com/'}
                    </a>
                </p>
            );

            licenseType = 'This software is offered under a commercial license.\n\nSee ENTERPRISE-EDITION-LICENSE.txt in your root install directory for details. See NOTICE.txt for information about open source software used in this system.';

            let fileName;
            if (this.state.fileName) {
                fileName = this.state.fileName;
            } else {
                fileName = (
                    <FormattedMessage
                        id='admin.license.noFile'
                        defaultMessage='No file uploaded'
                    />
                );
            }

            licenseKey = (
                <div className='col-sm-8'>
                    <div className='file__upload'>
                        <button className='btn btn-primary'>
                            <FormattedMessage
                                id='admin.license.choose'
                                defaultMessage='Choose File'
                            />
                        </button>
                        <input
                            ref='fileInput'
                            type='file'
                            accept='.mattermost-license'
                            onChange={this.handleChange}
                        />
                    </div>
                    <button
                        className={btnClass}
                        disabled={!this.state.fileSelected}
                        onClick={this.handleSubmit}
                        id='upload-button'
                        data-loading-text={'<span class=\'fa fa-refresh icon--rotate\'></span> ' + this.props.intl.formatMessage(holders.uploading)}
                    >
                        <FormattedMessage
                            id='admin.license.upload'
                            defaultMessage='Upload'
                        />
                    </button>
                    <div className='help-text no-margin'>
                        {fileName}
                    </div>
                    <br/>
                    {serverError}
                    <p className='help-text no-margin'>
                        <FormattedHTMLMessage
                            id='admin.license.uploadDesc'
                            defaultMessage='Upload a license key for Mattermost Enterprise Edition to upgrade this server. <a href="http://mattermost.com" target="_blank">Visit us online</a> to learn more about the benefits of Enterprise Edition or to purchase a key.'
                        />
                    </p>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h3 className='admin-console-header'>
                    <FormattedMessage
                        id='admin.license.title'
                        defaultMessage='Edition and License'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            <FormattedMessage
                                id='admin.license.edition'
                                defaultMessage='Edition: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            {edition}
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            <FormattedMessage
                                id='admin.license.type'
                                defaultMessage='License: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            {licenseType}
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            <FormattedMessage
                                id='admin.license.key'
                                defaultMessage='License Key: '
                            />
                        </label>
                        {licenseKey}
                    </div>
                </form>
            </div>
        );
    }
}

LicenseSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(LicenseSettings);
