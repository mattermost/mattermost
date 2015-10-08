// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AdminSidebarHeader = require('./admin_sidebar_header.jsx');
var SelectTeamModal = require('./select_team_modal.jsx');

export default class AdminSidebar extends React.Component {
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
    }

    isSelected(name, teamId) {
        if (this.props.selected === name) {
            if (name === 'team_users') {
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
        var count = '*';
        var teams = 'Loading';

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
                                        <span
                                            className='menu-icon--right menu__close'
                                            onClick={this.removeTeam.bind(this, team.id)}
                                            style={{cursor: 'pointer'}}
                                        >
                                            {'x'}
                                        </span>
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
                                                {'- Users'}
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
                                            <span>{'SETTINGS'}</span>
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
                                            {'Service Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('team_settings')}
                                            onClick={this.handleClick.bind(this, 'team_settings', null)}
                                        >
                                            {'Team Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('sql_settings')}
                                            onClick={this.handleClick.bind(this, 'sql_settings', null)}
                                        >
                                            {'SQL Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('email_settings')}
                                            onClick={this.handleClick.bind(this, 'email_settings', null)}
                                        >
                                            {'Email Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('image_settings')}
                                            onClick={this.handleClick.bind(this, 'image_settings', null)}
                                        >
                                            {'File Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('log_settings')}
                                            onClick={this.handleClick.bind(this, 'log_settings', null)}
                                        >
                                            {'Log Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('rate_settings')}
                                            onClick={this.handleClick.bind(this, 'rate_settings', null)}
                                        >
                                            {'Rate Limit Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('privacy_settings')}
                                            onClick={this.handleClick.bind(this, 'privacy_settings', null)}
                                        >
                                            {'Privacy Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('gitlab_settings')}
                                            onClick={this.handleClick.bind(this, 'gitlab_settings', null)}
                                        >
                                            {'GitLab Settings'}
                                        </a>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu'>
                                     <li>
                                        <h4>
                                            <span className='icon fa fa-gear'></span>
                                            <span>{'TEAMS (' + count + ')'}</span>
                                            <span className='menu-icon--right'>
                                                <a
                                                    href='#'
                                                    onClick={this.showTeamSelect}
                                                >
                                                    <i className='fa fa-plus'></i>
                                                </a>
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
                                            <span>{'OTHER'}</span>
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
                                            {'Logs'}
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
    teams: React.PropTypes.object,
    selectedTeams: React.PropTypes.object,
    removeSelectedTeam: React.PropTypes.func,
    addSelectedTeam: React.PropTypes.func,
    selected: React.PropTypes.string,
    selectedTeam: React.PropTypes.string,
    selectTab: React.PropTypes.func
};