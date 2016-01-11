// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from '../loading_screen.jsx';

import * as Client from '../../utils/client.jsx';

export default class ManageCommandHooks extends React.Component {
    constructor() {
        super();

        this.getHooks = this.getHooks.bind(this);
        this.addNewHook = this.addNewHook.bind(this);
        this.updateTrigger = this.updateTrigger.bind(this);
        this.updateURL = this.updateURL.bind(this);

        this.state = {hooks: [], channelId: '', trigger: '', URL: '', getHooksComplete: false};
    }

    componentDidMount() {
        this.getHooks();
    }

    addNewHook(e) {
        e.preventDefault();

        if (this.state.trigger === '' || this.state.URL === '') {
            return;
        }

        const hook = {};
        if (this.state.trigger.length !== 0) {
            hook.trigger = this.state.trigger.trim();
        }
        hook.url = this.state.URL.trim();

        Client.addCommand(
            hook,
            (data) => {
                let hooks = Object.assign([], this.state.hooks);
                if (!hooks) {
                    hooks = [];
                }
                hooks.push(data);
                this.setState({hooks, addError: null, triggerWords: '', URL: ''});
            },
            (err) => {
                this.setState({addError: err.message});
            }
        );
    }

    removeHook(id) {
        const data = {};
        data.id = id;

        Client.deleteCommand(
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
                this.setState({editError: err.message});
            }
        );
    }

    regenToken(id) {
        const regenData = {};
        regenData.id = id;

        Client.regenCommandToken(
            regenData,
            (data) => {
                const hooks = Object.assign([], this.state.hooks);
                for (let i = 0; i < hooks.length; i++) {
                    if (hooks[i].id === id) {
                        hooks[i] = data;
                        break;
                    }
                }

                this.setState({hooks, editError: null});
            },
            (err) => {
                this.setState({editError: err.message});
            }
        );
    }

    getHooks() {
        Client.listCommands(
            (data) => {
                if (data) {
                    this.setState({hooks: data, getHooksComplete: true, editError: null});
                }
            },
            (err) => {
                this.setState({editError: err.message});
            }
        );
    }

    updateTrigger(e) {
        this.setState({trigger: e.target.value});
    }

    updateURL(e) {
        this.setState({URL: e.target.value});
    }

    render() {
        let addError;
        if (this.state.addError) {
            addError = <label className='has-error'>{this.state.addError}</label>;
        }

        let editError;
        if (this.state.editError) {
            addError = <label className='has-error'>{this.state.editError}</label>;
        }

        const hooks = [];
        this.state.hooks.forEach((hook) => {
            let triggerDiv;
            if (hook.trigger && hook.trigger.length !== 0) {
                triggerDiv = (
                    <div className='padding-top'>
                        <strong>{'Trigger: '}</strong>{hook.trigger}
                    </div>
                );
            }

            hooks.push(
                <div
                    key={hook.id}
                    className='webhook__item'
                >
                    <div className='padding-top x2 webhook__url'>
                        <strong>{'URL: '}</strong><span className='word-break--all'>{hook.url}</span>
                    </div>
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
                        <a
                            className='webhook__remove'
                            href='#'
                            onClick={this.removeHook.bind(this, hook.id)}
                        >
                            <span aria-hidden='true'>{'×'}</span>
                        </a>
                    </div>
                    <div className='padding-top x2 divider-light'></div>
                </div>
            );
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
                <label className='control-label padding-top x2'>{'Existing commands'}</label>
                <div className='padding-top divider-light'></div>
                <div className='webhooks__list'>
                    {displayHooks}
                </div>
            </div>
        );

        const disableButton = this.state.trigger === '' || this.state.URL === '';

        return (
            <div key='addCommandHook'>
                {'Create commands to send new message events to an external integration. Please see '}
                <a
                    href='http://mattermost.org/commands'
                    target='_blank'
                >
                    {'http://mattermost.org/commands'}
                </a>
                {' to learn more.'}
                <div><label className='control-label padding-top x2'>{'Add a new command'}</label></div>
                <div className='padding-top divider-light'></div>
                <div className='padding-top'>
                    <div className='padding-top x2'>
                        <label className='control-label'>{'Trigger:'}</label>
                        <div className='padding-top'>
                            {'/'}
                            <input
                                ref='trigger'
                                className='form-control'
                                value={this.state.trigger}
                                onChange={this.updateTrigger}
                                placeholder='Command trigger e.g. "hello" not including the slash'
                            />
                        </div>
                        <div className='padding-top'>{'Word to trigger on'}</div>
                    </div>
                    <div className='padding-top x2'>
                        <label className='control-label'>{'Callback URL:'}</label>
                        <div className='padding-top'>
                        <textarea
                            ref='URL'
                            className='form-control no-resize'
                            value={this.state.URL}
                            resize={false}
                            rows={3}
                            onChange={this.URL}
                            placeholder='Must start with http:// or https://'
                        />
                        </div>
                        <div className='padding-top'>{'URL that will receive the HTTP POST or GET event'}</div>
                        {addError}
                    </div>
                    <div className='padding-top padding-bottom'>
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
                {editError}
            </div>
        );
    }
}
