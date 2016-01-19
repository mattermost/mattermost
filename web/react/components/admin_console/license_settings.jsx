// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages, FormattedHTMLMessage} from 'react-intl';
import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';

const messages = defineMessages({
    licensedEdition: {
        id: 'admin.licensed.licensedEdition',
        defaultMessage: 'Mattermost Enterprise Edition. Designed for enterprise-scale communication.'
    },
    under: {
        id: 'admin.licensed.under',
        defaultMessage: 'This compiled release of Mattermost platform is provided under a '
    },
    commercial: {
        id: 'admin.licensed.commercial',
        defaultMessage: 'commercial license'
    },
    subscription: {
        id: 'admin.licensed.subscription',
        defaultMessage: ' from Mattermost, Inc. based on your subscription level and is subject to the '
    },
    terms: {
        id: 'admin.licensed.terms',
        defaultMessage: 'Terms of Service.'
    },
    subscriptionDetails: {
        id: 'admin.licensed.subscriptionDetails',
        defaultMessage: 'Your subscription details are as follows:'
    },
    subscriptionName: {
        id: 'admin.licensed.subscriptionName',
        defaultMessage: 'Name: '
    },
    subscriptionCompany: {
        id: 'admin.licensed.subscriptionCompany',
        defaultMessage: 'Company or organization name: '
    },
    subscriptionUsers: {
        id: 'admin.licensed.subscriptionUsers',
        defaultMessage: 'Number of users: '
    },
    subscriptionIssued: {
        id: 'admin.licensed.subscriptionIssued',
        defaultMessage: 'License issued:'
    },
    subscriptionStart: {
        id: 'admin.licensed.subscriptionStart',
        defaultMessage: 'Start date of license: '
    },
    subscriptionExpires: {
        id: 'admin.licensed.subscriptionExpires',
        defaultMessage: 'Expiry date of license: '
    },
    subscriptionLdap: {
        id: 'admin.licensed.subscriptionLdap',
        defaultMessage: 'LDAP: '
    },
    removing: {
        id: 'admin.licensed.removing',
        defaultMessage: 'Removing License...'
    },
    downgrade: {
        id: 'admin.licensed.downgrade',
        defaultMessage: 'Remove Enterprise License and Downgrade Server'
    },
    freeEdition: {
        id: 'admin.licensed.freeEdition',
        defaultMessage: 'Mattermost Team Edition. Designed for teams from 5 to 50 users.'
    },
    uploading: {
        id: 'admin.licensed.uploading',
        defaultMessage: 'Uploading License...'
    },
    upload: {
        id: 'admin.licensed.upload',
        defaultMessage: 'Upload'
    },
    title: {
        id: 'admin.licensed.title',
        defaultMessage: 'Edition and License'
    },
    edition: {
        id: 'admin.licensed.edition',
        defaultMessage: 'Edition: '
    },
    license: {
        id: 'admin.licensed.license',
        defaultMessage: 'License: '
    },
    licenseKey: {
        id: 'admin.licensed.licenseKey',
        defaultMessage: 'License Key: '
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
            serverError: null
        };
    }

    handleChange() {
        const element = $(ReactDOM.findDOMNode(this.refs.fileInput));
        if (element.prop('files').length > 0) {
            this.setState({fileSelected: true});
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
                this.setState({serverError: null});
                window.location.reload(true);
            },
            (error) => {
                Utils.clearFileInput(element[0]);
                $('#upload-button').button('reset');
                this.setState({serverError: error.message});
            }
        );
    }

    handleRemove(e) {
        e.preventDefault();

        $('#remove-button').button('loading');

        Client.removeLicenseFile(
            () => {
                $('#remove-button').button('reset');
                this.setState({serverError: null});
                window.location.reload(true);
            },
            (error) => {
                $('#remove-button').button('reset');
                this.setState({serverError: error.message});
            }
        );
    }

    render() {
        const {formatMessage} = this.props.intl;
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
            edition = formatMessage(messages.licensedEdition);
            licenseType = (
                <div>
                    <p>
                        {formatMessage(messages.under)}
                        <a
                            href='http://mattermost.com'
                            target='_blank'
                        >
                            {formatMessage(messages.commercial)}
                        </a>
                        {formatMessage(messages.subscription)}
                        <a
                            href={global.window.mm_config.TermsOfServiceLink}
                            target='_blank'
                        >
                            {formatMessage(messages.terms)}
                       </a>
                    </p>
                    <p>{formatMessage(messages.subscriptionDetails)}</p>
                    {formatMessage(messages.subscriptionName) + global.window.mm_license.Name}
                    <br/>
                    {formatMessage(messages.subscriptionCompany) + global.window.mm_license.Company}
                    <br/>
                    {formatMessage(messages.subscriptionUsers) + global.window.mm_license.Users}
                    <br/>
                    {`${formatMessage(messages.subscriptionIssued)} ${Utils.displayDate(parseInt(global.window.mm_license.IssuedAt, 10))} ${Utils.displayTime(parseInt(global.window.mm_license.IssuedAt, 10), true)}`}
                    <br/>
                    {formatMessage(messages.subscriptionStart) + Utils.displayDate(parseInt(global.window.mm_license.StartsAt, 10))}
                    <br/>
                    {formatMessage(messages.subscriptionExpires) + Utils.displayDate(parseInt(global.window.mm_license.ExpiresAt, 10))}
                    <br/>
                    {formatMessage(messages.subscriptionLdap) + global.window.mm_license.LDAP}
                    <br/>
                </div>
            );

            licenseKey = (
                <div className='col-sm-8'>
                    <button
                        className='btn btn-danger'
                        onClick={this.handleRemove}
                        id='remove-button'
                        data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(messages.removing)}
                    >
                        {formatMessage(messages.downgrade)}
                    </button>
                    <br/>
                    <br/>
                    <p className='help-text'>
                        <FormattedHTMLMessage
                            id='admin.licensed.removeDesc'
                            defaultMessage='If you’re migrating servers you may need to remove your license key from this server in order to install it on a new server. To start, <a href="http://mattermost.com" target="_blank">disable all Enterprise Edition features on this server</a>. This will enable the ability to remove the license key and downgrade this server from Enterprise Edition to Team Edition.'
                        />
                    </p>
                </div>
            );
        } else {
            edition = formatMessage(messages.freeEdition);

            licenseType = (
                <span>
                    <FormattedHTMLMessage
                        id='admin.licensed.freeType'
                        defaultMessage='<p>This compiled release of Mattermost platform is offered under an MIT license.</p><p>See MIT-COMPILED-LICENSE.txt in your root install directory for details. See NOTICES.txt for information about open source software used in this system.</p>'
                    />
                </span>
            );

            licenseKey = (
                <div className='col-sm-8'>
                    <input
                        className='pull-left'
                        ref='fileInput'
                        type='file'
                        accept='.mattermost-license'
                        onChange={this.handleChange}
                    />
                    <button
                        className={btnClass + ' pull-left'}
                        disabled={!this.state.fileSelected}
                        onClick={this.handleSubmit}
                        id='upload-button'
                        data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(messages.license)}
                    >
                        {formatMessage(messages.upload)}
                    </button>
                    <br/>
                    <br/>
                    <br/>
                    {serverError}
                    <p className='help-text'>
                        <FormattedHTMLMessage
                            id='admin.licensed.uploadDesc'
                            defaultMessage='Upload a license key for Mattermost Enterprise Edition to upgrade this server.<a href="http://mattermost.com" target="_blank">Visit us online</a> to learn more about the benefits of Enterprise Edition or to purchase a key.'
                        />
                    </p>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h3>{formatMessage(messages.title)}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            {formatMessage(messages.edition)}
                        </label>
                        <div className='col-sm-8'>
                            {edition}
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            {formatMessage(messages.license)}
                        </label>
                        <div className='col-sm-8'>
                            {licenseType}
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            {formatMessage(messages.licenseKey)}
                        </label>
                        {licenseKey}
                    </div>
                </form>
            </div>
        );
    }
}

LicenseSettings.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(LicenseSettings);