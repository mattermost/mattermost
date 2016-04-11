// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';

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
        if ($.isEmptyObject(this.state.config)) {
            return <div className='admin-console'/>;
        }

        // not every page in the system console will need the config, but the vast majority will
        const children = React.cloneElement(this.props.children, {
            config: this.state.config
        });

        return (
            <div className='admin-console'>
                <AdminSidebar/>
                {children}
            </div>
        );
    }
}
