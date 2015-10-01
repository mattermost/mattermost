// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var Constants = require('../../utils/constants.jsx');
var ChannelStore = require('../../stores/channel_store.jsx');
var LoadingScreen = require('../loading_screen.jsx');

export default class ManageOutgoingHooks extends React.Component {
    constructor() {
        super();

        this.getHooks = this.getHooks.bind(this);
        this.addNewHook = this.addNewHook.bind(this);
        this.updateChannelId = this.updateChannelId.bind(this);
        this.updateTriggerWords = this.updateTriggerWords.bind(this);
        this.updateCallbackURLs = this.updateCallbackURLs.bind(this);

        this.state = {hooks: [], channelId: '', triggerWords: '', callbackURLs: '', getHooksComplete: false};
    }
    componentDidMount() {
        this.getHooks();
    }
    addNewHook(e) {
        e.preventDefault();

        if ((this.state.channelId === '' && this.state.triggerWords === '') ||
                this.state.callbackURLs === '') {
            return;
        }

        const hook = {};
        hook.channel_id = this.state.channelId;
        if (this.state.triggerWords.length !== 0) {
            hook.trigger_words = this.state.triggerWords.trim().split(',');
        }
        hook.callback_urls = this.state.callbackURLs.split('\n');

        Client.addOutgoingHook(
            hook,
            (data) => {
                let hooks = this.state.hooks;
                if (!hooks) {
                    hooks = [];
                }
                hooks.push(data);
                this.setState({hooks, serverError: null});
            },
            (err) => {
                this.setState({serverError: err});
            }
        );
    }
    removeHook(id) {
        const data = {};
        data.id = id;

        Client.deleteOutgoingHook(
            data,
            () => {
                const hooks = this.state.hooks;
                let index = -1;
                for (let i = 0; i < hooks.length; i++) {
                    if (hooks[i].id === id) {
                        index = i;
                        break;
                    }
                }

                if (index !== -1) {
                    hooks.splice(index, 1);
                }

                this.setState({hooks});
            },
            (err) => {
                this.setState({serverError: err});
            }
        );
    }
    regenToken(id) {
        const regenData = {};
        regenData.id = id;

        Client.regenOutgoingHookToken(
            regenData,
            (data) => {
                const hooks = Object.assign([], this.state.hooks);
                for (let i = 0; i < hooks.length; i++) {
                    if (hooks[i].id === id) {
                        hooks[i] = data;
                        break;
                    }
                }

                this.setState({hooks});
            },
            (err) => {
                this.setState({serverError: err});
            }
        );
    }
    getHooks() {
        Client.listOutgoingHooks(
            (data) => {
                const state = this.state;

                if (data) {
                    state.hooks = data;
                }

                state.getHooksComplete = true;
                this.setState(state);
            },
            (err) => {
                this.setState({serverError: err});
            }
        );
    }
    updateChannelId(e) {
        this.setState({channelId: e.target.value});
    }
    updateTriggerWords(e) {
        this.setState({triggerWords: e.target.value});
    }
    updateCallbackURLs(e) {
        this.setState({callbackURLs: e.target.value});
    }
    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = <label className='has-error'>{this.state.serverError}</label>;
        }

        const channels = ChannelStore.getAll();
        const options = [<option value=''>{'--- Select a channel ---'}</option>];
        channels.forEach((channel) => {
            if (channel.type === Constants.OPEN_CHANNEL) {
                options.push(<option value={channel.id}>{channel.name}</option>);
            }
        });

        const hooks = [];
        this.state.hooks.forEach((hook) => {
            const c = ChannelStore.get(hook.channel_id);
            let channelDiv;
            if (c) {
                channelDiv = (
                    <div className='padding-top'>
                        <strong>{'Channel: '}</strong>{c.name}
                    </div>
                );
            }

            let triggerDiv;
            if (hook.trigger_words && hook.trigger_words.length !== 0) {
                triggerDiv = (
                    <div className='padding-top'>
                        <strong>{'Trigger Words: '}</strong>{hook.trigger_words.join(', ')}
                    </div>
                );
            }

            hooks.push(
                <div className='font--small'>
                    <div className='padding-top x2 divider-light'></div>
                    <div className='padding-top x2'>
                        <strong>{'URLs: '}</strong><span className='word-break--all'>{hook.callback_urls.join(', ')}</span>
                    </div>
                    {channelDiv}
                    {triggerDiv}
                    <div className='padding-top'>
                        <strong>{'Token: '}</strong>{hook.token}
                    </div>
                    <div className='padding-top'>
                        <a
                            className='text-danger'
                            href='#'
                            onClick={this.regenToken.bind(this, hook.id)}
                        >
                            {'Regen Token'}
                        </a>
                        <span>{' - '}</span>
                        <a
                            className='text-danger'
                            href='#'
                            onClick={this.removeHook.bind(this, hook.id)}
                        >
                            {'Remove'}
                        </a>
                    </div>
                </div>
            );
        });

        let displayHooks;
        if (!this.state.getHooksComplete) {
            displayHooks = <LoadingScreen/>;
        } else if (hooks.length > 0) {
            displayHooks = hooks;
        } else {
            displayHooks = <label>{': None'}</label>;
        }

        const existingHooks = (
            <div className='padding-top x2'>
                <label className='control-label padding-top x2'>{'Existing outgoing webhooks'}</label>
                {displayHooks}
            </div>
        );

        const disableButton = (this.state.channelId === '' && this.state.triggerWords === '') || this.state.callbackURLs === '';

        return (
            <div key='addOutgoingHook'>
                <label className='control-label'>{'Add a new outgoing webhook'}</label>
                <div className='padding-top'>
                    <strong>{'Channel:'}</strong>
                    <select
                        ref='channelName'
                        className='form-control'
                        value={this.state.channelId}
                        onChange={this.updateChannelId}
                    >
                        {options}
                    </select>
                    <span>{'Only public channels can be used'}</span>
                    <br/>
                    <br/>
                    <strong>{'Trigger Words:'}</strong>
                    <input
                        ref='triggerWords'
                        className='form-control'
                        value={this.state.triggerWords}
                        onChange={this.updateTriggerWords}
                        placeholder='Optional if channel selected'
                    />
                    <span>{'Comma separated words to trigger on'}</span>
                    <br/>
                    <br/>
                    <strong>{'Callback URLs:'}</strong>
                    <textarea
                        ref='callbackURLs'
                        className='form-control no-resize'
                        value={this.state.callbackURLs}
                        resize={false}
                        rows={3}
                        onChange={this.updateCallbackURLs}
                    />
                    <span>{'New line separated URLs that will receive the HTTP POST event'}</span>
                    {serverError}
                    <div className='padding-top'>
                        <a
                            className={'btn btn-sm btn-primary'}
                            href='#'
                            disabled={disableButton}
                            onClick={this.addNewHook}
                        >
                            {'Add'}
                        </a>
                    </div>
                </div>
                {existingHooks}
            </div>
        );
    }
}
