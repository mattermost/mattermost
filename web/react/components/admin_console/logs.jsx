// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AdminStore = require('../../stores/admin_store.jsx');
var LoadingScreen = require('../loading_screen.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

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
            content = <LoadingScreen />;
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

                content.push(<br key={'br_' + i} />);
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
                <h3>{'Server Logs'}</h3>
                <button
                    type='submit'
                    className='btn btn-primary'
                    onClick={this.reload}
                >
                    {'Reload'}
                </button>
                <div className='log__panel'>
                    {content}
                </div>
            </div>
        );
    }
}