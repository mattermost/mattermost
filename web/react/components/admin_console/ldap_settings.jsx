// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

const DEFAULT_LDAP_PORT = 389;
const DEFAULT_QUERY_TIMEOUT = 60;

export default class LdapSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleEnable = this.handleEnable.bind(this);
        this.handleDisable = this.handleDisable.bind(this);

        this.state = {
            saveNeeded: false,
            serverError: null,
            enable: this.props.config.LdapSettings.Enable
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
        config.LdapSettings.Enable = this.refs.Enable.checked;
        config.LdapSettings.LdapServer = this.refs.LdapServer.value.trim();

        let LdapPort = DEFAULT_LDAP_PORT;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.LdapPort).value, 10))) {
            LdapPort = parseInt(ReactDOM.findDOMNode(this.refs.LdapPort).value, 10);
        }
        config.LdapSettings.LdapPort = LdapPort;

        config.LdapSettings.BaseDN = this.refs.BaseDN.value.trim();
        config.LdapSettings.BindUsername = this.refs.BindUsername.value.trim();
        config.LdapSettings.BindPassword = this.refs.BindPassword.value.trim();
        config.LdapSettings.FirstNameAttribute = this.refs.FirstNameAttribute.value.trim();
        config.LdapSettings.LastNameAttribute = this.refs.LastNameAttribute.value.trim();
        config.LdapSettings.EmailAttribute = this.refs.EmailAttribute.value.trim();
        config.LdapSettings.UsernameAttribute = this.refs.UsernameAttribute.value.trim();
        config.LdapSettings.IdAttribute = this.refs.IdAttribute.value.trim();

        let QueryTimeout = DEFAULT_QUERY_TIMEOUT;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.QueryTimeout).value, 10))) {
            QueryTimeout = parseInt(ReactDOM.findDOMNode(this.refs.QueryTimeout).value, 10);
        }
        config.LdapSettings.QueryTimeout = QueryTimeout;

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

        const licenseEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.LDAP === 'true';

        let bannerContent;
        if (licenseEnabled) {
            bannerContent = (
                <div className='banner'>
                    <div className='banner__content'>
                        <h4 className='banner__heading'>{'Note:'}</h4>
                        <p>{'If a user attribute changes on the LDAP server it will be updated the next time the user enters their credentials to log in to Mattermost. This includes if a user is made inactive or removed from an LDAP server. Synchronization with LDAP servers is planned in a future release.'}</p>
                    </div>
                </div>
            );
        } else {
            bannerContent = (
                <div className='banner warning'>
                    <div className='banner__content'>
                        <h4 className='banner__heading'>{'Note:'}</h4>
                        <p>
                            {'LDAP is an enterprise feature. Your current license does not support LDAP. Click '}
                            <a
                                href='http://mattermost.com'
                                target='_blank'
                            >
                            {'here'}
                            </a>
                            {' for information and pricing on enterprise licenses.'}
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                {bannerContent}
                <h3>{'LDAP Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Enable'
                        >
                            {'Enable Login With LDAP:'}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='true'
                                    ref='Enable'
                                    defaultChecked={this.props.config.LdapSettings.Enable}
                                    onChange={this.handleEnable}
                                    disabled={!licenseEnabled}
                                />
                                {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='false'
                                    defaultChecked={!this.props.config.LdapSettings.Enable}
                                    onChange={this.handleDisable}
                                />
                                {'false'}
                            </label>
                            <p className='help-text'>{'When true, Mattermost allows login using LDAP'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='LdapServer'
                        >
                            {'LDAP Server:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='LdapServer'
                                ref='LdapServer'
                                placeholder='Ex "10.0.0.23"'
                                defaultValue={this.props.config.LdapSettings.LdapServer}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The domain or IP address of LDAP server.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='LdapPort'
                        >
                            {'LDAP Port:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='number'
                                className='form-control'
                                id='LdapPort'
                                ref='LdapPort'
                                placeholder='Ex "389"'
                                defaultValue={this.props.config.LdapSettings.LdapPort}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The port Mattermost will use to connect to the LDAP server. Default is 389.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='BaseDN'
                        >
                            {'BaseDN:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='BaseDN'
                                ref='BaseDN'
                                placeholder='Ex "dc=mydomain,dc=com"'
                                defaultValue={this.props.config.LdapSettings.BaseDN}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The Base DN is the Distinguished Name of the location where Mattermost should start its search for users in the LDAP tree.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='BindUsername'
                        >
                            {'Bind Username:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='BindUsername'
                                ref='BindUsername'
                                placeholder=''
                                defaultValue={this.props.config.LdapSettings.BindUsername}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The username used to perform the LDAP search. This should typically be an account created specifically for use with Mattermost. It should have access limited to read the portion of the LDAP tree specified in the BaseDN field.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='BindPassword'
                        >
                            {'Bind Password:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='password'
                                className='form-control'
                                id='BindPassword'
                                ref='BindPassword'
                                placeholder=''
                                defaultValue={this.props.config.LdapSettings.BindPassword}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'Password of the user given in "Bind Username".'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='FirstNameAttribute'
                        >
                            {'First Name Attrubute'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='FirstNameAttribute'
                                ref='FirstNameAttribute'
                                placeholder='Ex "givenName"'
                                defaultValue={this.props.config.LdapSettings.FirstNameAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The attribute in the LDAP server that will be used to populate the first name of users in Mattermost.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='LastNameAttribute'
                        >
                            {'Last Name Attribute:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='LastNameAttribute'
                                ref='LastNameAttribute'
                                placeholder='Ex "sn"'
                                defaultValue={this.props.config.LdapSettings.LastNameAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The attribute in the LDAP server that will be used to populate the last name of users in Mattermost.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EmailAttribute'
                        >
                            {'Email Attribute:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='EmailAttribute'
                                ref='EmailAttribute'
                                placeholder='Ex "mail"'
                                defaultValue={this.props.config.LdapSettings.EmailAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The attribute in the LDAP server that will be used to populate the email addresses of users in Mattermost.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='UsernameAttribute'
                        >
                            {'Username Attribute:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='UsernameAttribute'
                                ref='UsernameAttribute'
                                placeholder='Ex "sAMAccountName"'
                                defaultValue={this.props.config.LdapSettings.UsernameAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The attribute in the LDAP server that will be used to populate the username field in Mattermost. This may be the same as the ID Attribute.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='IdAttribute'
                        >
                            {'Id Attribute: '}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='IdAttribute'
                                ref='IdAttribute'
                                placeholder='Ex "sAMAccountName"'
                                defaultValue={this.props.config.LdapSettings.IdAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The attribute in the LDAP server that will be used as a unique identifier in Mattermost. It should be an LDAP attribute with a value that does not change, such as username or uid. If a user’s Id Attribute changes, it will create a new Mattermost account unassociated with their old one. This is the value used to log in to Mattermost in the "LDAP Username" field on the sign in page. Normally this attribute is the same as the “Username Attribute” field above. If your team typically uses domain\\username to sign in to other services with LDAP, you may choose to put domain\\username in this field to maintain consistency between sites.'}</p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='QueryTimeout'
                        >
                            {'Query Timeout (seconds):'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='number'
                                className='form-control'
                                id='QueryTimeout'
                                ref='QueryTimeout'
                                placeholder='Ex "60"'
                                defaultValue={this.props.config.LdapSettings.QueryTimeout}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>{'The timeout value for queries to the LDAP server. Increase if you are getting timeout errors caused by a slow LDAP server.'}</p>
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> Saving Config...'}
                            >
                                {'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}
LdapSettings.defaultProps = {
};

LdapSettings.propTypes = {
    config: React.PropTypes.object
};
