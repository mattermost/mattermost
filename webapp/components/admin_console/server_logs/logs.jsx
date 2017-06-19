// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LoadingScreen from 'components/loading_screen.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

export default class Logs extends React.PureComponent {
    static propTypes = {

        /*
         * Array of logs to render
         */
        logs: PropTypes.arrayOf(PropTypes.string).isRequired,

        actions: PropTypes.shape({

            /*
             * Function to fetch logs
             */
            getLogs: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            loadingLogs: true
        };
    }

    componentDidMount() {
        this.refs.logPanel.focus();

        this.props.actions.getLogs().then(
            () => this.setState({loadingLogs: false})
        );
    }

    componentDidUpdate() {
        // Scroll Down to get the latest logs
        var node = this.refs.logPanel;
        node.scrollTop = node.scrollHeight;
        node.focus();
    }

    reload = () => {
        this.setState({loadingLogs: true});
        this.props.actions.getLogs().then(
            () => this.setState({loadingLogs: false})
        );
    }

    render() {
        let content = null;

        if (this.state.loadingLogs) {
            content = <LoadingScreen/>;
        } else {
            content = [];

            for (let i = 0; i < this.props.logs.length; i++) {
                const style = {
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace'
                };

                if (this.props.logs[i].indexOf('[EROR]') > 0) {
                    style.color = 'red';
                }

                content.push(<br key={'br_' + i}/>);
                content.push(
                    <span
                        key={'log_' + i}
                        style={style}
                    >
                        {this.props.logs[i]}
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
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='admin.logs.bannerDesc'
                            defaultMessage='To look up users by User ID, go to Reporting > Users and paste the ID into the search filter.'
                        />
                    </div>
                </div>
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
