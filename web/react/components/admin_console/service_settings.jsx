// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

export default class ServiceSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            saveNeeded: false,
            serverError: null
        };
    }

    handleChange() {
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.ServiceSettings.ListenAddress = React.findDOMNode(this.refs.ListenAddress).value.trim();
        if (config.ServiceSettings.ListenAddress === '') {
            config.ServiceSettings.ListenAddress = ':8065';
            React.findDOMNode(this.refs.ListenAddress).value = config.ServiceSettings.ListenAddress;
        }

        config.ServiceSettings.SegmentDeveloperKey = React.findDOMNode(this.refs.SegmentDeveloperKey).value.trim();
        config.ServiceSettings.GoogleDeveloperKey = React.findDOMNode(this.refs.GoogleDeveloperKey).value.trim();
        //config.ServiceSettings.EnableOAuthServiceProvider = React.findDOMNode(this.refs.EnableOAuthServiceProvider).checked;
        config.ServiceSettings.EnableIncomingWebhooks = React.findDOMNode(this.refs.EnableIncomingWebhooks).checked;
        config.ServiceSettings.EnablePostUsernameOverride = React.findDOMNode(this.refs.EnablePostUsernameOverride).checked;
        config.ServiceSettings.EnablePostIconOverride = React.findDOMNode(this.refs.EnablePostIconOverride).checked;
        config.ServiceSettings.EnableTesting = React.findDOMNode(this.refs.EnableTesting).checked;

        var MaximumLoginAttempts = 10;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.MaximumLoginAttempts).value, 10))) {
            MaximumLoginAttempts = parseInt(React.findDOMNode(this.refs.MaximumLoginAttempts).value, 10);
        }
        config.ServiceSettings.MaximumLoginAttempts = MaximumLoginAttempts;
        React.findDOMNode(this.refs.MaximumLoginAttempts).value = MaximumLoginAttempts;

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
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass = 'btn btn-primary';
        }

        return (
            <div className='wrapper--fixed'>

                <h3>{'Service Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ListenAddress'
                        >
                            {'Listen Address:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ListenAddress'
                                ref='ListenAddress'
                                placeholder='Ex ":8065"'
                                defaultValue={this.props.config.ServiceSettings.ListenAddress}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'The address to which to bind and listen. Entering ":8065" will bind to all interfaces or you can choose one like "127.0.0.1:8065".  Changing this will require a server restart before taking effect.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaximumLoginAttempts'
                        >
                            {'Maximum Login Attempts:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaximumLoginAttempts'
                                ref='MaximumLoginAttempts'
                                placeholder='Ex "10"'
                                defaultValue={this.props.config.ServiceSettings.MaximumLoginAttempts}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Login attempts allowed before user is locked out and required to reset password via email.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SegmentDeveloperKey'
                        >
                            {'Segment Developer Key:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SegmentDeveloperKey'
                                ref='SegmentDeveloperKey'
                                placeholder='Ex "g3fgGOXJAQ43QV7rAh6iwQCkV4cA1Gs"'
                                defaultValue={this.props.config.ServiceSettings.SegmentDeveloperKey}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'For users running a SaaS services, sign up for a key at Segment.com to track metrics.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='GoogleDeveloperKey'
                        >
                            {'Google Developer Key:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='GoogleDeveloperKey'
                                ref='GoogleDeveloperKey'
                                placeholder='Ex "7rAh6iwQCkV4cA1Gsg3fgGOXJAQ43QV"'
                                defaultValue={this.props.config.ServiceSettings.GoogleDeveloperKey}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Set this key to enable embedding of YouTube video previews based on hyperlinks appearing in messages or comments. Instructions to obtain a key available at '}<a href='https://www.youtube.com/watch?v=Im69kzhpR3I'>{'https://www.youtube.com/watch?v=Im69kzhpR3I'}</a>{'. Leaving field blank disables the automatic generation of YouTube video previews from links.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableIncomingWebhooks'
                        >
                            {'Enable Incoming Webhooks: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableIncomingWebhooks'
                                    value='true'
                                    ref='EnableIncomingWebhooks'
                                    defaultChecked={this.props.config.ServiceSettings.EnableIncomingWebhooks}
                                    onChange={this.handleChange}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableIncomingWebhooks'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableIncomingWebhooks}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When true, incoming webhooks will be allowed. To help combat phishing attacks, all posts from webhooks will be labelled by a BOT tag.'}</p>
                        </div>
                    </div>

                     <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePostUsernameOverride'
                        >
                            {'Enable Overriding Usernames from Webhooks: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostUsernameOverride'
                                    value='true'
                                    ref='EnablePostUsernameOverride'
                                    defaultChecked={this.props.config.ServiceSettings.EnablePostUsernameOverride}
                                    onChange={this.handleChange}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostUsernameOverride'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnablePostUsernameOverride}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When true, webhooks will be allowed to change the username they are posting as. Note, combined with allowing icon overriding, this could open users up to phishing attacks.'}</p>
                        </div>
                    </div>

                     <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePostIconOverride'
                        >
                            {'Enable Overriding Icon from Webhooks: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostIconOverride'
                                    value='true'
                                    ref='EnablePostIconOverride'
                                    defaultChecked={this.props.config.ServiceSettings.EnablePostIconOverride}
                                    onChange={this.handleChange}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostIconOverride'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnablePostIconOverride}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When true, webhooks will be allowed to change the icon they post with. Note, combined with allowing username overriding, this could open users up to phishing attacks.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableTesting'
                        >
                            {'Enable Testing: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTesting'
                                    value='true'
                                    ref='EnableTesting'
                                    defaultChecked={this.props.config.ServiceSettings.EnableTesting}
                                    onChange={this.handleChange}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTesting'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableTesting}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'(Developer Option) When true, /loadtest slash command is enabled to load test accounts and test data. Changing this will require a server restart before taking effect.'}</p>
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

// <div className='form-group'>
//     <label
//         className='control-label col-sm-4'
//         htmlFor='EnableOAuthServiceProvider'
//     >
//         {'Enable OAuth Service Provider: '}
//     </label>
//     <div className='col-sm-8'>
//         <label className='radio-inline'>
//             <input
//                 type='radio'
//                 name='EnableOAuthServiceProvider'
//                 value='true'
//                 ref='EnableOAuthServiceProvider'
//                 defaultChecked={this.props.config.ServiceSettings.EnableOAuthServiceProvider}
//                 onChange={this.handleChange}
//             />
//                 {'true'}
//         </label>
//         <label className='radio-inline'>
//             <input
//                 type='radio'
//                 name='EnableOAuthServiceProvider'
//                 value='false'
//                 defaultChecked={!this.props.config.ServiceSettings.EnableOAuthServiceProvider}
//                 onChange={this.handleChange}
//             />
//                 {'false'}
//         </label>
//         <p className='help-text'>{'When enabled Mattermost will act as an OAuth2 Provider.  Changing this will require a server restart before taking effect.'}</p>
//     </div>
// </div>

ServiceSettings.propTypes = {
    config: React.PropTypes.object
};
