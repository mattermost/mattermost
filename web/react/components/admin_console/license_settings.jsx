// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

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

        const formData = new FormData();
        formData.append('license', file, file.name);

        Client.uploadLicenseFile(formData,
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

        Client.removeLicenseFile(
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
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var btnClass = 'btn';
        if (this.state.fileSelected) {
            btnClass = 'btn btn-primary';
        }

        let edition;
        let licenseType;
        let licenseKey;

        if (global.window.mm_license.IsLicensed === 'true') {
            edition = (
                <FormattedMessage
                    id='admin.license.enterpriseEdition'
                    defaultMessage='Mattermost Enterprise Edition. Designed for enterprise-scale communication.'
                />
            );
            licenseType = (
                <FormattedHTMLMessage
                    id='admin.license.enterpriseType'
                    values={{
                        terms: global.window.mm_config.TermsOfServiceLink,
                        name: global.window.mm_license.Name,
                        company: global.window.mm_license.Company,
                        users: global.window.mm_license.Users,
                        issued: Utils.displayDate(parseInt(global.window.mm_license.IssuedAt, 10)) + ' ' + Utils.displayTime(parseInt(global.window.mm_license.IssuedAt, 10), true),
                        start: Utils.displayDate(parseInt(global.window.mm_license.StartsAt, 10)),
                        expires: Utils.displayDate(parseInt(global.window.mm_license.ExpiresAt, 10)),
                        ldap: global.window.mm_license.LDAP
                    }}
                    defaultMessage='<div><p>This compiled release of Mattermost platform is provided under a <a href="http://mattermost.com" target="_blank">commercial license</a> from Mattermost, Inc. based on your subscription level and is subject to the <a href="{terms}" target="_blank">Terms of Service.</a></p>
                    <p>Your subscription details are as follows:</p>
                    Name: {name}<br />
                    Company or organization name: {company}<br/>
                    Number of users: {users}<br/>
                    License issued: {issued}<br/>
                    Start date of license: {start}<br/>
                    Expiry date of license: {expires}<br/>
                    LDAP: {ldap}<br/></div>'
                />
            );

            licenseKey = (
                <div className='col-sm-8'>
                    <button
                        disabled={this.props.config.LdapSettings.Enable}
                        className='btn btn-danger'
                        onClick={this.handleRemove}
                        id='remove-button'
                        data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + this.props.intl.formatMessage(holders.removing)}
                    >
                        <FormattedMessage
                            id='admin.license.keyRemove'
                            defaultMessage='Remove Enterprise License and Downgrade Server'
                        />
                    </button>
                    <br/>
                    <br/>
                    <p className='help-text'>
                        <FormattedHTMLMessage
                            id='admin.licence.keyMigration'
                            defaultMessage='If you’re migrating servers you may need to remove your license key from this server in order to install it on a new server. To start, <a href="http://mattermost.com" target="_blank">disable all Enterprise Edition features on this server</a>. This will enable the ability to remove the license key and downgrade this server from Enterprise Edition to Team Edition.'
                        />
                    </p>
                </div>
            );
        } else {
            edition = (
                <FormattedMessage
                    id='admin.license.teamEdition'
                    defaultMessage='Mattermost Team Edition. Designed for teams from 5 to 50 users.'
                />
            );

            licenseType = (
                <FormattedHTMLMessage
                    id='admin.license.teamType'
                    defaultMessage='<span><p>This compiled release of Mattermost platform is offered under an MIT license.</p>
                    <p>See MIT-COMPILED-LICENSE.txt in your root install directory for details. See NOTICES.txt for information about open source software used in this system.</p></span>'
                />
            );

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
                        <button className='btn btn-default'>
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
                        data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + this.props.intl.formatMessage(holders.uploading)}
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
                <h3>
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
