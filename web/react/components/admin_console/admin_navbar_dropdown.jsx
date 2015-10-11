// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Utils = require('../../utils/utils.jsx');
var Client = require('../../utils/client.jsx');
var TeamStore = require('../../stores/team_store.jsx');

var Constants = require('../../utils/constants.jsx');

function getStateFromStores() {
    return {currentTeam: TeamStore.getCurrent()};
}

export default class AdminNavbarDropdown extends React.Component {
    constructor(props) {
        super(props);
        this.blockToggle = false;

        this.handleLogoutClick = this.handleLogoutClick.bind(this);

        this.state = getStateFromStores();
    }

    handleLogoutClick(e) {
        e.preventDefault();
        Client.logout();
    }

    componentDidMount() {
        $(React.findDOMNode(this.refs.dropdown)).on('hide.bs.dropdown', () => {
            this.blockToggle = true;
            setTimeout(() => {
                this.blockToggle = false;
            }, 100);
        });
    }

    componentWillUnmount() {
        $(React.findDOMNode(this.refs.dropdown)).off('hide.bs.dropdown');
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
                            <a
                                href={Utils.getWindowLocationOrigin() + '/' + this.state.currentTeam.name}
                            >
                                {'Switch to ' + this.state.currentTeam.display_name}
                            </a>
                        </li>
                        <li>
                            <a
                                href='#'
                                onClick={this.handleLogoutClick}
                            >
                                {'Logout'}
                            </a>
                        </li>
                        <li className='divider'></li>
                        <li>
                            <a
                                target='_blank'
                                href='/static/help/help.html'
                            >
                                {'Help'}
                            </a>
                        </li>
                        <li>
                            <a
                                target='_blank'
                                href='/static/help/report_problem.html'
                            >
                                {'Report a Problem'}
                            </a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}