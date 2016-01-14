// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';

export default class LicenseSettings extends React.Component {
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
            edition = 'Mattermost Enterprise Edition. Designed for enterprise-scale communication.';
            licenseType = (
                <div>
                    <p>
                        {'This compiled release of Mattermost platform is provided under a '}
                        <a
                            href='http://mattermost.com'
                            target='_blank'
                        >
                            {'commercial license'}
                        </a>
                        {' from Mattermost, Inc. based on your subscription level and is subject to the '}
                        <a
                            href={global.window.mm_config.TermsOfServiceLink}
                            target='_blank'
                        >
                            {'Terms of Service.'}
                       </a>
                    </p>
                    <p>{'Your subscription details are as follows:'}</p>
                    {'Name: ' + global.window.mm_license.Name}
                    <br/>
                    {'Company or organization name: ' + global.window.mm_license.Company}
                    <br/>
                    {'Number of users: ' + global.window.mm_license.Users}
                    <br/>
                    {`License issued: ${Utils.displayDate(parseInt(global.window.mm_license.IssuedAt, 10))} ${Utils.displayTime(parseInt(global.window.mm_license.IssuedAt, 10), true)}`}
                    <br/>
                    {'Start date of license: ' + Utils.displayDate(parseInt(global.window.mm_license.StartsAt, 10))}
                    <br/>
                    {'Expiry date of license: ' + Utils.displayDate(parseInt(global.window.mm_license.ExpiresAt, 10))}
                    <br/>
                    {'LDAP: ' + global.window.mm_license.LDAP}
                    <br/>
                </div>
            );

            licenseKey = (
                <div className='col-sm-8'>
                    <button
                        className='btn btn-danger'
                        onClick={this.handleRemove}
                        id='remove-button'
                        data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> Removing License...'}
                    >
                        {'Remove Enterprise License and Downgrade Server'}
                    </button>
                    <br/>
                    <br/>
                    <p className='help-text'>
                        {'If you’re migrating servers you may need to remove your license key from this server in order to install it on a new server. To start, '}
                        <a
                            href='http://mattermost.com'
                            target='_blank'
                        >
                            {'disable all Enterprise Edition features on this server'}
                        </a>
                        {'. This will enable the ability to remove the license key and downgrade this server from Enterprise Edition to Team Edition.'}
                    </p>
                </div>
            );
        } else {
            edition = 'Mattermost Team Edition. Designed for teams from 5 to 50 users.';

            licenseType = (
                <span>
                    <p>{'This compiled release of Mattermost platform is offered under an MIT license.'}</p>
                    <p>{'See MIT-COMPILED-LICENSE.txt in your root install directory for details. See NOTICES.txt for information about open source software used in this system.'}</p>
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
                        data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> Uploading License...'}
                    >
                        {'Upload'}
                    </button>
                    <br/>
                    <br/>
                    <br/>
                    {serverError}
                    <p className='help-text'>
                        {'Upload a license key for Mattermost Enterprise Edition to upgrade this server. '}
                        <a
                            href='http://mattermost.com'
                            target='_blank'
                        >
                            {'Visit us online'}
                        </a>
                        {' to learn more about the benefits of Enterprise Edition or to purchase a key.'}
                    </p>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h3>{'Edition and License'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            {'Edition: '}
                        </label>
                        <div className='col-sm-8'>
                            {edition}
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            {'License: '}
                        </label>
                        <div className='col-sm-8'>
                            {licenseType}
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            {'License Key: '}
                        </label>
                        {licenseKey}
                    </div>
                </form>
            </div>
        );
    }
}
