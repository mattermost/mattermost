// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

export default class RateSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            EnableRateLimiter: this.props.config.RateLimitSettings.EnableRateLimiter,
            VaryByRemoteAddr: this.props.config.RateLimitSettings.VaryByRemoteAddr,
            saveNeeded: false,
            serverError: null
        };
    }

    handleChange(action) {
        var s = {saveNeeded: true, serverError: this.state.serverError};

        if (action === 'EnableRateLimiterTrue') {
            s.EnableRateLimiter = true;
        }

        if (action === 'EnableRateLimiterFalse') {
            s.EnableRateLimiter = false;
        }

        if (action === 'VaryByRemoteAddrTrue') {
            s.VaryByRemoteAddr = true;
        }

        if (action === 'VaryByRemoteAddrFalse') {
            s.VaryByRemoteAddr = false;
        }

        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.RateLimitSettings.EnableRateLimiter = React.findDOMNode(this.refs.EnableRateLimiter).checked;
        config.RateLimitSettings.VaryByRemoteAddr = React.findDOMNode(this.refs.VaryByRemoteAddr).checked;
        config.RateLimitSettings.VaryByHeader = React.findDOMNode(this.refs.VaryByHeader).value.trim();

        var PerSec = 10;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.PerSec).value, 10))) {
            PerSec = parseInt(React.findDOMNode(this.refs.PerSec).value, 10);
        }
        config.RateLimitSettings.PerSec = PerSec;
        React.findDOMNode(this.refs.PerSec).value = PerSec;

        var MemoryStoreSize = 10000;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.MemoryStoreSize).value, 10))) {
            MemoryStoreSize = parseInt(React.findDOMNode(this.refs.MemoryStoreSize).value, 10);
        }
        config.RateLimitSettings.MemoryStoreSize = MemoryStoreSize;
        React.findDOMNode(this.refs.MemoryStoreSize).value = MemoryStoreSize;

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

                <div className='banner'>
                    <div className='banner__content'>
                        <h4 className='banner__heading'>{'Note:'}</h4>
                        <p>{'Changing properties in this section will require a server restart before taking effect.'}</p>
                    </div>
                </div>

                <h3>{'Rate Limit Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableRateLimiter'
                        >
                            {'Enable Rate Limiter: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableRateLimiter'
                                    value='true'
                                    ref='EnableRateLimiter'
                                    defaultChecked={this.props.config.RateLimitSettings.EnableRateLimiter}
                                    onChange={this.handleChange.bind(this, 'EnableRateLimiterTrue')}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableRateLimiter'
                                    value='false'
                                    defaultChecked={!this.props.config.RateLimitSettings.EnableRateLimiter}
                                    onChange={this.handleChange.bind(this, 'EnableRateLimiterFalse')}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When true, APIs are throttled at rates specified below.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PerSec'
                        >
                            {'Number Of Queries Per Second:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PerSec'
                                ref='PerSec'
                                placeholder='Ex "10"'
                                defaultValue={this.props.config.RateLimitSettings.PerSec}
                                onChange={this.handleChange}
                                disabled={!this.state.EnableRateLimiter}
                            />
                            <p className='help-text'>{'Throttles API at this number of requests per second.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MemoryStoreSize'
                        >
                            {'Memory Store Size:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MemoryStoreSize'
                                ref='MemoryStoreSize'
                                placeholder='Ex "10000"'
                                defaultValue={this.props.config.RateLimitSettings.MemoryStoreSize}
                                onChange={this.handleChange}
                                disabled={!this.state.EnableRateLimiter}
                            />
                            <p className='help-text'>{'Maximum number of users sessions connected to the system as determined by "Vary By Remote Address" and "Vary By Header" settings below.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='VaryByRemoteAddr'
                        >
                            {'Vary By Remote Address: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='VaryByRemoteAddr'
                                    value='true'
                                    ref='VaryByRemoteAddr'
                                    defaultChecked={this.props.config.RateLimitSettings.VaryByRemoteAddr}
                                    onChange={this.handleChange.bind(this, 'VaryByRemoteAddrTrue')}
                                    disabled={!this.state.EnableRateLimiter}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='VaryByRemoteAddr'
                                    value='false'
                                    defaultChecked={!this.props.config.RateLimitSettings.VaryByRemoteAddr}
                                    onChange={this.handleChange.bind(this, 'VaryByRemoteAddrFalse')}
                                    disabled={!this.state.EnableRateLimiter}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'When true, rate limit API access by IP address.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='VaryByHeader'
                        >
                            {'Vary By HTTP Header:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='VaryByHeader'
                                ref='VaryByHeader'
                                placeholder='Ex "X-Real-IP", "X-Forwarded-For"'
                                defaultValue={this.props.config.RateLimitSettings.VaryByHeader}
                                onChange={this.handleChange}
                                disabled={!this.state.EnableRateLimiter || this.state.VaryByRemoteAddr}
                            />
                            <p className='help-text'>{'When filled in, vary rate limiting by HTTP header field specified (e.g. when configuring Ngnix set to "X-Real-IP", when configuring AmazonELB set to "X-Forwarded-For").'}</p>
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

RateSettings.propTypes = {
    config: React.PropTypes.object
};
