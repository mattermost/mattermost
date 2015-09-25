// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var Utils = require('../../utils/utils.jsx');
var Constants = require('../../utils/constants.jsx');
var ChannelStore = require('../../stores/channel_store.jsx');
var LoadingScreen = require('../loading_screen.jsx');

export default class ManageIncomingHooks extends React.Component {
    constructor() {
        super();

        this.getHooks = this.getHooks.bind(this);
        this.addNewHook = this.addNewHook.bind(this);
        this.updateChannelId = this.updateChannelId.bind(this);

        this.state = {hooks: [], channelId: ChannelStore.getByName(Constants.DEFAULT_CHANNEL).id, getHooksComplete: false};
    }
    componentDidMount() {
        this.getHooks();
    }
    addNewHook() {
        let hook = {}; //eslint-disable-line prefer-const
        hook.channel_id = this.state.channelId;

        Client.addIncomingHook(
            hook,
            (data) => {
                let hooks = this.state.hooks;
                if (!hooks) {
                    hooks = [];
                }
                hooks.push(data);
                this.setState({hooks});
            },
            (err) => {
                this.setState({serverError: err});
            }
        );
    }
    removeHook(id) {
        let data = {}; //eslint-disable-line prefer-const
        data.id = id;

        Client.deleteIncomingHook(
            data,
            () => {
                let hooks = this.state.hooks; //eslint-disable-line prefer-const
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
    getHooks() {
        Client.listIncomingHooks(
            (data) => {
                let state = this.state; //eslint-disable-line prefer-const

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
    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = <label className='has-error'>{this.state.serverError}</label>;
        }

        const channels = ChannelStore.getAll();
        let options = []; //eslint-disable-line prefer-const
        channels.forEach((channel) => {
            options.push(<option value={channel.id}>{channel.name}</option>);
        });

        let disableButton = '';
        if (this.state.channelId === '') {
            disableButton = ' disable';
        }

        let hooks = []; //eslint-disable-line prefer-const
        this.state.hooks.forEach((hook) => {
            const c = ChannelStore.get(hook.channel_id);
            hooks.push(
                <div className='font--small'>
                    <div className='padding-top x2 divider-light'></div>
                    <div className='padding-top x2'>
                        <strong>{'URL: '}</strong><span className='word-break--all'>{Utils.getWindowLocationOrigin() + '/hooks/' + hook.id}</span>
                    </div>
                    <div className='padding-top'>
                        <strong>{'Channel: '}</strong>{c.name}
                    </div>
                    <div className='padding-top'>
                        <a
                            className={'text-danger'}
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
                <label className='control-label padding-top x2'>{'Existing incoming webhooks'}</label>
                {displayHooks}
            </div>
        );

        return (
            <div key='addIncomingHook'>
                <label className='control-label'>{'Add a new incoming webhook'}</label>
                <div className='padding-top'>
                    <select
                        ref='channelName'
                        className='form-control'
                        value={this.state.channelId}
                        onChange={this.updateChannelId}
                    >
                        {options}
                    </select>
                    {serverError}
                    <div className='padding-top'>
                        <a
                            className={'btn btn-sm btn-primary' + disableButton}
                            href='#'
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
