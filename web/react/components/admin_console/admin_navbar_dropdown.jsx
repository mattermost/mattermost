// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Utils from '../../utils/utils.jsx';
import * as Client from '../../utils/client.jsx';
import TeamStore from '../../stores/team_store.jsx';

import Constants from '../../utils/constants.jsx';

const messages = defineMessages({
    switch: {
        id: 'admin.nav.switch',
        defaultMessage: 'Switch to '
    },
    logout: {
        id: 'admin.nav.logout',
        defaultMessage: 'Logout'
    },
    help: {
        id: 'admin.nav.help',
        defaultMessage: 'Help'
    },
    report: {
        id: 'admin.nav.report',
        defaultMessage: 'Report a Problem'
    }
});

function getStateFromStores() {
    return {currentTeam: TeamStore.getCurrent()};
}

class AdminNavbarDropdown extends React.Component {
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
        const {formatMessage} = this.props.intl;

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
                                {formatMessage(messages.switch) + this.state.currentTeam.display_name}
                            </a>
                        </li>
                        <li>
                            <a
                                href='#'
                                onClick={this.handleLogoutClick}
                            >
                                {formatMessage(messages.logout)}
                            </a>
                        </li>
                        <li className='divider'></li>
                        <li>
                            <a
                                target='_blank'
                                href='http://ayuda.zboxapp.com/collection/65-chat'
                            >
                                {formatMessage(messages.help)}
                            </a>
                        </li>
                        <li>
                            <a
                                target='_blank'
                                href='http://ayuda.zboxapp.com/collection/65-chat#contactModal'
                            >
                                {formatMessage(messages.report)}
                            </a>
                        </li>
                    </ul>
                </li>
            </ul>
        );
    }
}

AdminNavbarDropdown.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(AdminNavbarDropdown);