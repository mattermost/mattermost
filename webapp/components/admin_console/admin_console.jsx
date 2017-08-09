// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import 'bootstrap';

import AnnouncementBar from 'components/announcement_bar';
import AdminSidebar from './admin_sidebar.jsx';

import {reloadIfServerVersionChanged} from 'actions/global_actions.jsx';

export default class AdminConsole extends React.Component {
    static propTypes = {

        /*
         * Children components to render
         */
        children: PropTypes.node.isRequired,

        /*
         * Object representing the config file
         */
        config: PropTypes.object.isRequired,

        actions: PropTypes.shape({

            /*
             * Function to get the config file
             */
            getConfig: PropTypes.func.isRequired
        }).isRequired
    }

    componentWillMount() {
        this.props.actions.getConfig();
        reloadIfServerVersionChanged();
    }

    render() {
        const config = this.props.config;
        if (Object.keys(config).length === 0) {
            return <div/>;
        }
        if (config && Object.keys(config).length === 0 && config.constructor === 'Object') {
            return (
                <div className='admin-console__wrapper'>
                    <AnnouncementBar/>
                    <div className='admin-console'/>
                </div>
            );
        }

        // not every page in the system console will need the config, but the vast majority will
        const children = React.cloneElement(this.props.children, {
            config
        });
        return (
            <div className='admin-console__wrapper'>
                <AnnouncementBar/>
                <div className='admin-console'>
                    <AdminSidebar/>
                    {children}
                </div>
            </div>
        );
    }
}
