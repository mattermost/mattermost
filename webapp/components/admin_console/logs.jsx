// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AdminStore from 'stores/admin_store.jsx';
import LoadingScreen from '../loading_screen.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class Logs extends React.Component {
    constructor(props) {
        super(props);

        this.onLogListenerChange = this.onLogListenerChange.bind(this);
        this.reload = this.reload.bind(this);

        this.state = {
            logs: AdminStore.getLogs()
        };
    }

    componentDidMount() {
        AdminStore.addLogChangeListener(this.onLogListenerChange);
        AsyncClient.getLogs();
        this.refs.logPanel.focus();
    }

    componentDidUpdate() {
        // Scroll Down to get the latest logs
        var node = this.refs.logPanel;
        node.scrollTop = node.scrollHeight;
        node.focus();
    }

    componentWillUnmount() {
        AdminStore.removeLogChangeListener(this.onLogListenerChange);
    }

    onLogListenerChange() {
        this.setState({
            logs: AdminStore.getLogs()
        });
    }

    reload() {
        AdminStore.saveLogs(null);
        this.setState({
            logs: null
        });

        AsyncClient.getLogs();
    }

    render() {
        var content = null;

        if (this.state.logs === null) {
            content = <LoadingScreen/>;
        } else {
            content = [];

            for (var i = 0; i < this.state.logs.length; i++) {
                var style = {
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace'
                };

                if (this.state.logs[i].indexOf('[EROR]') > 0) {
                    style.color = 'red';
                }

                content.push(<br key={'br_' + i}/>);
                content.push(
                    <span
                        key={'log_' + i}
                        style={style}
                    >
                        {this.state.logs[i]}
                    </span>
                );
            }
        }

        return (
            <div className='panel'>
                <h3 className='admin-console-header'>
                    <FormattedMessage
                        id='admin.logs.title'
                        defaultMessage='Server Logs'
                    />
                </h3>
                <button
                    type='submit'
                    className='btn btn-primary'
                    onClick={this.reload}
                >
                    <FormattedMessage
                        id='admin.logs.reload'
                        defaultMessage='Reload'
                    />
                </button>
                <div
                    tabIndex='-1'
                    ref='logPanel'
                    className='log__panel'
                >
                    {content}
                </div>
            </div>
        );
    }
}
