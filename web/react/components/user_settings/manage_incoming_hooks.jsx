// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as Utils from '../../utils/utils.jsx';
import Constants from '../../utils/constants.jsx';
import ChannelStore from '../../stores/channel_store.jsx';
import LoadingScreen from '../loading_screen.jsx';

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
        const hook = {};
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
        const data = {};
        data.id = id;

        Client.deleteIncomingHook(
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
    getHooks() {
        Client.listIncomingHooks(
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
    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = <label className='has-error'>{this.state.serverError}</label>;
        }

        const channels = ChannelStore.getAll();
        const options = [];
        channels.forEach((channel) => {
            if (channel.type !== Constants.DM_CHANNEL) {
                options.push(
                    <option
                        key={'incoming-hook' + channel.id}
                        value={channel.id}
                    >
                        {channel.display_name}
                    </option>
                );
            }
        });

        let disableButton = '';
        if (this.state.channelId === '') {
            disableButton = ' disable';
        }

        const hooks = [];
        this.state.hooks.forEach((hook) => {
            const c = ChannelStore.get(hook.channel_id);
            if (c) {
                hooks.push(
                    <div
                        key={hook.id}
                        className='webhook__item'
                    >
                        <div className='padding-top x2 webhook__url'>
                            <strong>{'URL: '}</strong>
                            <span className='word-break--all'>{Utils.getWindowLocationOrigin() + '/hooks/' + hook.id}</span>
                        </div>
                        <div className='padding-top'>
                            <strong>{'Channel: '}</strong>{c.display_name}
                        </div>
                        <a
                            className={'webhook__remove'}
                            href='#'
                            onClick={this.removeHook.bind(this, hook.id)}
                        >
                            <span aria-hidden='true'>{'×'}</span>
                        </a>
                        <div className='padding-top x2 divider-light'></div>
                    </div>
                );
            }
        });

        let displayHooks;
        if (!this.state.getHooksComplete) {
            displayHooks = <LoadingScreen/>;
        } else if (hooks.length > 0) {
            displayHooks = hooks;
        } else {
            displayHooks = <div className='padding-top x2'>{'None'}</div>;
        }

        const existingHooks = (
            <div className='webhooks__container'>
                <label className='control-label padding-top x2'>{'Existing incoming webhooks'}</label>
                <div className='padding-top divider-light'></div>
                <div className='webhooks__list'>
                    {displayHooks}
                </div>
            </div>
        );

        return (
            <div key='addIncomingHook'>
                {'Create webhook URLs for use in external integrations. Please see '}<a href='http://mattermost.org/webhooks'>{'http://mattermost.org/webhooks'}</a> {' to learn more.'}
                <div><label className='control-label padding-top x2'>{'Add a new incoming webhook'}</label></div>
                <div className='row padding-top'>
                    <div className='col-sm-10 padding-bottom'>
                        <select
                            ref='channelName'
                            className='form-control'
                            value={this.state.channelId}
                            onChange={this.updateChannelId}
                        >
                            {options}
                        </select>
                        {serverError}
                    </div>
                    <div className='col-sm-2 col-xs-4 no-padding--left padding-bottom'>
                        <a
                            className={'btn form-control no-padding btn-sm btn-primary' + disableButton}
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
