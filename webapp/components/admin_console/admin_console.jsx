// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import 'bootstrap';

import AnnouncementBar from 'components/announcement_bar';
import DiscardChangesModal from 'components/discard_changes_modal.jsx';

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

        /*
         * String whether to show prompt to navigate away
         * from unsaved changes
         */
        showNavigationPrompt: PropTypes.bool.isRequired,

        actions: PropTypes.shape({

            /*
             * Function to get the config file
             */
            getConfig: PropTypes.func.isRequired,

            /*
             * Function to block navigation when there are unsaved changes
             */
            setNavigationBlocked: PropTypes.func.isRequired,

            /*
             * Function to confirm navigation
             */
            confirmNavigation: PropTypes.func.isRequired,

            /*
             * Function to cancel navigation away from unsaved changes
             */
            cancelNavigation: PropTypes.func.isRequired
        }).isRequired
    }

    componentWillMount() {
        this.props.actions.getConfig();
        reloadIfServerVersionChanged();
    }

    render() {
        const {config, showNavigationPrompt} = this.props;
        const {setNavigationBlocked, cancelNavigation, confirmNavigation} = this.props.actions;

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

        const discardChangesModal = (
            <DiscardChangesModal
                show={showNavigationPrompt}
                onConfirm={confirmNavigation}
                onCancel={cancelNavigation}
            />
        );

        // not every page in the system console will need the config, but the vast majority will
        const children = React.cloneElement(this.props.children, {
            config,
            setNavigationBlocked
        });
        return (
            <div className='admin-console__wrapper'>
                <AnnouncementBar/>
                <div className='admin-console'>
                    <AdminSidebar/>
                    {children}
                </div>
                {discardChangesModal}
            </div>
        );
    }
}
