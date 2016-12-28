// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Dropdown} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import Client from 'client/web_client.jsx';
import Constants from 'utils/constants.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import statusAway from 'images/icons/IC_DM_Away.svg';
import statusOnline from 'images/icons/IC_DM_Online.svg';
import statusOffline from 'images/icons/IC_DM_Offline.svg';

export default class SidebarHeaderStatusDropdown extends React.Component {
    static propTypes = {
        status: React.PropTypes.string
    };

    constructor(props) {
        super(props);

        this.toggleDropdown = this.toggleDropdown.bind(this);
        this.setUserAway = this.setUserAway.bind(this);
        this.setUserOnline = this.setUserOnline.bind(this);
        this.setUserOffline = this.setUserOffline.bind(this);

        this.state = {
            showDropdown: false
        };
    }

    toggleDropdown(e) {
        if (e) {
            e.preventDefault();
        }

        this.setState({showDropdown: !this.state.showDropdown});
    }

    setUserAway() {
        this.toggleDropdown();
        Client.setStatus(Constants.UserStatuses.AWAY,
            () => {
                // DO nothing.
            },
            (err) => {
                AsyncClient.dispatchError(err, 'setStatus');
            }
        );
    }

    setUserOnline() {
        this.toggleDropdown();
        Client.setStatus(Constants.UserStatuses.ONLINE,
            () => {
                // DO nothing.
            },
            (err) => {
                AsyncClient.dispatchError(err, 'setStatus');
            }
        );
    }

    setUserOffline() {
        this.toggleDropdown();
        Client.setStatus(Constants.UserStatuses.OFFLINE,
            () => {
                // DO nothing.
            },
            (err) => {
                AsyncClient.dispatchError(err, 'setStatus');
            }
        );
    }

    render() {
        return (
            <Dropdown
                open={this.state.showDropdown}
                onClose={this.toggleDropdown}
                className='sidebar-header-status-dropdown'
                pullRight={true}
            >
                <Dropdown.Menu>
                    <li>
                        <a
                            href='#'
                            onClick={this.setUserOnline}
                        >
                            <img src={statusOnline}/>
                            <FormattedMessage
                                id='yes'
                                defaultMessage='Available'
                            />
                        </a>
                    </li>
                    <li>
                        <a
                            href='#'
                            onClick={this.setUserAway}
                        >
                            <img src={statusAway}/>
                            <FormattedMessage
                                id='yes'
                                defaultMessage='Away'
                            />
                        </a>
                    </li>
                    <li>
                        <a
                            href='#'
                            onClick={this.setUserOffline}
                        >
                            <img src={statusOffline}/>
                            <FormattedMessage
                                id='yes'
                                defaultMessage='Offline'
                            />
                        </a>
                    </li>
                </Dropdown.Menu>
            </Dropdown>
        );
    }
}