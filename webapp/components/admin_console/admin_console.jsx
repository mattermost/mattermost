// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import 'bootstrap';

import ErrorBar from 'components/error_bar.jsx';
import AdminStore from 'stores/admin_store.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import AdminSidebar from './admin_sidebar.jsx';

export default class AdminConsole extends React.Component {
    static get propTypes() {
        return {
            children: React.PropTypes.node.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleConfigChange = this.handleConfigChange.bind(this);

        this.state = {
            config: AdminStore.getConfig()
        };
    }

    componentWillMount() {
        AdminStore.addConfigChangeListener(this.handleConfigChange);
        AsyncClient.getConfig();
    }

    componentWillUnmount() {
        AdminStore.removeConfigChangeListener(this.handleConfigChange);
    }

    handleConfigChange() {
        this.setState({
            config: AdminStore.getConfig()
        });
    }

    render() {
        const config = this.state.config;
        if (!config) {
            return <div/>;
        }
        if (config && Object.keys(config).length === 0 && config.constructor === 'Object') {
            return (
                <div className='admin-console__wrapper'>
                    <ErrorBar/>
                    <div className='admin-console'/>
                </div>
            );
        }

        // not every page in the system console will need the config, but the vast majority will
        const children = React.cloneElement(this.props.children, {
            config: this.state.config
        });
        return (
            <div className='admin-console__wrapper'>
                <ErrorBar/>
                <div className='admin-console'>
                    <AdminSidebar/>
                    {children}
                </div>
            </div>
        );
    }
}
