// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import * as Utils from 'utils/utils.jsx';
import TeamStore from 'stores/team_store.jsx';

import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

import {Link} from 'react-router';

function getStateFromStores() {
    return {currentTeam: TeamStore.getCurrent()};
}

import React from 'react';

export default class AdminNavbarDropdown extends React.Component {
    constructor(props) {
        super(props);
        this.blockToggle = false;

        this.state = getStateFromStores();
    }

    componentDidMount() {
        $(ReactDOM.findDOMNode(this.refs.dropdown)).on('hide.bs.dropdown', () => {
            this.blockToggle = true;
            setTimeout(() => {
                this.blockToggle = false;
            }, 100);
        });
    }

    componentWillUnmount() {
        $(ReactDOM.findDOMNode(this.refs.dropdown)).off('hide.bs.dropdown');
    }

    render() {
        return (
            <ul className='nav navbar-nav navbar-right'>
                <li
                    ref='dropdown'
                    className='dropdown'
                >
                    <a
                        href='#'
                        className='dropdown-toggle'
                        data-toggle='dropdown'
                        role='button'
                        aria-expanded='false'
                    >
                        <span
                            className='dropdown__icon'
                            dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}}
                        />
                    </a>
                    <ul
                        className='dropdown-menu'
                        role='menu'
                    >
                        <li>
                            <Link
                                to={Utils.getWindowLocationOrigin() + '/' + this.state.currentTeam.name + '/channels/town-square'}
                            >
                                <FormattedMessage
                                    id='admin.nav.switch'
                                    defaultMessage='Switch to {display_name}'
                                    values={{
                                        display_name: this.state.currentTeam.display_name
                                    }}
                                />
                            </Link>
                        </li>
                        <li>
                            <Link to={Utils.getTeamURLFromAddressBar() + '/logout'}>
                                <FormattedMessage
                                    id='admin.nav.logout'
                                    defaultMessage='Logout'
                                />
                            </Link>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}
