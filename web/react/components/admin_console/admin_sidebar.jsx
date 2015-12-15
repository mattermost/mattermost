// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import AdminSidebarHeader from './admin_sidebar_header.jsx';
import SelectTeamModal from './select_team_modal.jsx';
import * as Utils from '../../utils/utils.jsx';

const Tooltip = ReactBootstrap.Tooltip;
const OverlayTrigger = ReactBootstrap.OverlayTrigger;

const messages = defineMessages({
    loading: {
        id: 'admin.sidebar.loading',
        defaultMessage: 'Loading'
    },
    users: {
        id: 'admin.sidebar.users',
        defaultMessage: '- Users'
    },
    settings: {
        id: 'admin.sidebar.settings',
        defaultMessage: 'SETTINGS'
    },
    service: {
        id: 'admin.sidebar.service',
        defaultMessage: 'Service Settings'
    },
    team: {
        id: 'admin.sidebar.team',
        defaultMessage: 'Team Settings'
    },
    sql: {
        id: 'admin.sidebar.sql',
        defaultMessage: 'SQL Settings'
    },
    email: {
        id: 'admin.sidebar.email',
        defaultMessage: 'Email Settings'
    },
    file: {
        id: 'admin.sidebar.file',
        defaultMessage: 'File Settings'
    },
    log: {
        id: 'admin.sidebar.log',
        defaultMessage: 'Log Settings'
    },
    rateLimit: {
        id: 'admin.sidebar.rate_limit',
        defaultMessage: 'Rate Limit Settings'
    },
    privacy: {
        id: 'admin.sidebar.privacy',
        defaultMessage: 'Privacy Settings'
    },
    gitlab: {
        id: 'admin.sidebar.gitlab',
        defaultMessage: 'GitLab Settings'
    },
    zbox: {
        id: 'admin.sidebar.zbox',
        defaultMessage: 'ZBox Settings'
    },
    teams: {
        id: 'admin.sidebar.teams',
        defaultMessage: 'TEAMS'
    },
    other: {
        id: 'admin.sidebar.other',
        defaultMessage: 'OTHER'
    },
    logs: {
        id: 'admin.sidebar.logs',
        defaultMessage: 'Logs'
    },
    statistics: {
        id: 'admin.sidebar.statistics',
        defaultMessage: '- Statistics'
    },
    rmTeamSidebar: {
        id: 'admin.sidebar.rmTeamSidebar',
        defaultMessage: 'Remove team from sidebar menu'
    },
    addTeamSidebar: {
        id: 'admin.sidebar.addTeamSidebar',
        defaultMessage: 'Add team to sidebar menu'
    },
    support: {
        id: 'admin.sidebar.support',
        defaultMessage: 'Legal and Support Settings'
    }
});

class AdminSidebar extends React.Component {
    constructor(props) {
        super(props);

        this.isSelected = this.isSelected.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.removeTeam = this.removeTeam.bind(this);

        this.showTeamSelect = this.showTeamSelect.bind(this);
        this.teamSelectedModal = this.teamSelectedModal.bind(this);
        this.teamSelectedModalDismissed = this.teamSelectedModalDismissed.bind(this);

        this.state = {
            showSelectModal: false
        };
    }

    handleClick(name, teamId, e) {
        e.preventDefault();
        this.props.selectTab(name, teamId);
        var tokenIndex = Utils.getUrlParameter('session_token_index');
        history.pushState({name, teamId}, null, `/admin_console/${name}/${teamId || ''}?session_token_index=${tokenIndex}`);
    }

    isSelected(name, teamId) {
        if (this.props.selected === name) {
            if (name === 'team_users' || name === 'team_analytics') {
                if (this.props.selectedTeam != null && this.props.selectedTeam === teamId) {
                    return 'active';
                }
            } else {
                return 'active';
            }
        }

        return '';
    }

    removeTeam(teamId, e) {
        e.preventDefault();
        Reflect.deleteProperty(this.props.selectedTeams, teamId);
        this.props.removeSelectedTeam(teamId);

        if (this.props.selected === 'team_users') {
            if (this.props.selectedTeam != null && this.props.selectedTeam === teamId) {
                this.props.selectTab('service_settings', null);
            }
        }
    }

    componentDidMount() {
        if ($(window).width() > 768) {
            $('.nav-pills__container').perfectScrollbar();
        }
    }

    showTeamSelect(e) {
        e.preventDefault();
        this.setState({showSelectModal: true});
    }

    teamSelectedModal(teamId) {
        this.props.selectedTeams[teamId] = 'true';
        this.setState({showSelectModal: false});
        this.props.addSelectedTeam(teamId);
        this.forceUpdate();
    }

    teamSelectedModalDismissed() {
        this.setState({showSelectModal: false});
    }

    render() {
        const {formatMessage} = this.props.intl;
        var count = '*';
        var teams = formatMessage(messages.loading);
        const removeTooltip = (
            <Tooltip id='remove-team-tooltip'>{formatMessage(messages.rmTeamSidebar)}</Tooltip>
        );
        const addTeamTooltip = (
            <Tooltip id='add-team-tooltip'>{formatMessage(messages.addTeamSidebar)}</Tooltip>
        );

        if (this.props.teams != null) {
            count = '' + Object.keys(this.props.teams).length;

            teams = [];
            for (var key in this.props.selectedTeams) {
                if (this.props.selectedTeams.hasOwnProperty(key)) {
                    var team = this.props.teams[key];

                    if (team != null) {
                        teams.push(
                            <ul
                                key={'team_' + team.id}
                                className='nav nav__sub-menu'
                            >
                                <li>
                                    <a
                                        href='#'
                                        onClick={this.handleClick.bind(this, 'team_users', team.id)}
                                        className={'nav__sub-menu-item ' + this.isSelected('team_users', team.id)}
                                    >
                                        {team.name}
                                        <OverlayTrigger
                                            delayShow={1000}
                                            placement='top'
                                            overlay={removeTooltip}
                                        >
                                        <span
                                            className='menu-icon--right menu__close'
                                            onClick={this.removeTeam.bind(this, team.id)}
                                            style={{cursor: 'pointer'}}
                                        >
                                            {'×'}
                                        </span>
                                        </OverlayTrigger>
                                    </a>
                                </li>
                                <li>
                                    <ul className='nav nav__inner-menu'>
                                        <li>
                                            <a
                                                href='#'
                                                className={this.isSelected('team_users', team.id)}
                                                onClick={this.handleClick.bind(this, 'team_users', team.id)}
                                            >
                                                {formatMessage(messages.users)}
                                            </a>
                                        </li>
                                        <li>
                                            <a
                                                href='#'
                                                className={this.isSelected('team_analytics', team.id)}
                                                onClick={this.handleClick.bind(this, 'team_analytics', team.id)}
                                            >
                                                {formatMessage(messages.statistics)}
                                            </a>
                                        </li>
                                    </ul>
                                </li>
                            </ul>
                        );
                    }
                }
            }
        }

        return (
            <div className='sidebar--left sidebar--collapsable'>
                <div>
                    <AdminSidebarHeader />
                    <div className='nav-pills__container'>
                        <ul className='nav nav-pills nav-stacked'>
                            <li>
                                <ul className='nav nav__sub-menu'>
                                    <li>
                                        <h4>
                                            <span className='icon fa fa-gear'></span>
                                            <span>{formatMessage(messages.settings)}</span>
                                        </h4>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu padded'>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('service_settings')}
                                            onClick={this.handleClick.bind(this, 'service_settings', null)}
                                        >
                                            {formatMessage(messages.settings)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('team_settings')}
                                            onClick={this.handleClick.bind(this, 'team_settings', null)}
                                        >
                                            {formatMessage(messages.team)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('sql_settings')}
                                            onClick={this.handleClick.bind(this, 'sql_settings', null)}
                                        >
                                            {formatMessage(messages.sql)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('email_settings')}
                                            onClick={this.handleClick.bind(this, 'email_settings', null)}
                                        >
                                            {formatMessage(messages.email)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('image_settings')}
                                            onClick={this.handleClick.bind(this, 'image_settings', null)}
                                        >
                                            {formatMessage(messages.file)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('log_settings')}
                                            onClick={this.handleClick.bind(this, 'log_settings', null)}
                                        >
                                            {formatMessage(messages.log)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('rate_settings')}
                                            onClick={this.handleClick.bind(this, 'rate_settings', null)}
                                        >
                                            {formatMessage(messages.rateLimit)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('privacy_settings')}
                                            onClick={this.handleClick.bind(this, 'privacy_settings', null)}
                                        >
                                            {formatMessage(messages.privacy)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('gitlab_settings')}
                                            onClick={this.handleClick.bind(this, 'gitlab_settings', null)}
                                        >
                                            {formatMessage(messages.gitlab)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('zbox_settings')}
                                            onClick={this.handleClick.bind(this, 'zbox_settings', null)}
                                        >
                                            {formatMessage(messages.zbox)}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('legal_and_support_settings')}
                                            onClick={this.handleClick.bind(this, 'legal_and_support_settings', null)}
                                        >
                                            {formatMessage(messages.support)}
                                        </a>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu'>
                                     <li>
                                        <h4>
                                            <span className='icon fa fa-gear'></span>
                                            <span>{formatMessage(messages.teams) + ' (' + count + ')'}</span>
                                            <span className='menu-icon--right'>
                                                <OverlayTrigger
                                                    delayShow={1000}
                                                    placement='top'
                                                    overlay={addTeamTooltip}
                                                >
                                                <a
                                                    href='#'
                                                    onClick={this.showTeamSelect}
                                                >
                                                    <i
                                                        className='fa fa-plus'
                                                    ></i>
                                                </a>
                                                </OverlayTrigger>
                                            </span>
                                        </h4>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu padded'>
                                    <li>
                                        {teams}
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu'>
                                    <li>
                                        <h4>
                                            <span className='icon fa fa-gear'></span>
                                            <span>{formatMessage(messages.other)}</span>
                                        </h4>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu padded'>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('logs')}
                                            onClick={this.handleClick.bind(this, 'logs', null)}
                                        >
                                            {formatMessage(messages.logs)}
                                        </a>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>

                <SelectTeamModal
                    teams={this.props.teams}
                    show={this.state.showSelectModal}
                    onModalSubmit={this.teamSelectedModal}
                    onModalDismissed={this.teamSelectedModalDismissed}
                />
            </div>
        );
    }
}

AdminSidebar.propTypes = {
    intl: intlShape.isRequired,
    teams: React.PropTypes.object,
    selectedTeams: React.PropTypes.object,
    removeSelectedTeam: React.PropTypes.func,
    addSelectedTeam: React.PropTypes.func,
    selected: React.PropTypes.string,
    selectedTeam: React.PropTypes.string,
    selectTab: React.PropTypes.func
};

export default injectIntl(AdminSidebar);