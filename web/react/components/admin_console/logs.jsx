// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import AdminStore from '../../stores/admin_store.jsx';
import LoadingScreen from '../loading_screen.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

const messages = defineMessages({
    title: {
        id: 'admin.logs.title',
        defaultMessage: 'Server Logs'
    },
    reload: {
        id: 'admin.logs.reload',
        defaultMessage: 'Reload'
    }
});

class Logs extends React.Component {
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
        const {formatMessage} = this.props.intl;
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
                <h3>{formatMessage(messages.title)}</h3>
                <button
                    type='submit'
                    className='btn btn-primary'
                    onClick={this.reload}
                >
                    {formatMessage(messages.reload)}
                </button>
                <div className='log__panel'>
                    {content}
                </div>
            </div>
        );
    }
}

Logs.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(Logs);