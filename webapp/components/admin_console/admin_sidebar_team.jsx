// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import AdminSidebarSection from './admin_sidebar_section.jsx';

export default class AdminSidebarTeam extends React.Component {
    static get propTypes() {
        return {
            team: React.PropTypes.object.isRequired,
            onRemoveTeam: React.PropTypes.func.isRequired,
            parentLink: React.PropTypes.string
        };
    }

    constructor(props) {
        super(props);

        this.handleRemoveTeam = this.handleRemoveTeam.bind(this);
    }

    handleRemoveTeam(e) {
        e.preventDefault();

        this.props.onRemoveTeam(this.props.team);
    }

    render() {
        const team = this.props.team;

        const removeTeamTooltip = (
            <Tooltip id='remove-team-tooltip'>
                <FormattedMessage
                    id='admin.sidebar.rmTeamSidebar'
                    defaultMessage='Remove team from sidebar menu'
                />
            </Tooltip>
        );

        const removeTeamButton = (
            <OverlayTrigger
                delayShow={1000}
                placement='top'
                overlay={removeTeamTooltip}
            >
                <span
                    className='menu-icon--right menu__close'
                    onClick={this.handleRemoveTeam}
                >
                    {'×'}
                </span>
            </OverlayTrigger>
        );

        return (
            <AdminSidebarSection
                key={team.id}
                name={'team/' + team.id}
                parentLink={this.props.parentLink}
                title={team.display_name}
                action={removeTeamButton}
            >
                <AdminSidebarSection
                    name='users'
                    title={
                        <FormattedMessage
                            id='admin.sidebar.users'
                            defaultMessage='- Users'
                        />
                    }
                />
                <AdminSidebarSection
                    name='analytics'
                    title={
                        <FormattedMessage
                            id='admin.sidebar.statistics'
                            defaultMessage='- Team Statistics'
                        />
                    }
                />
            </AdminSidebarSection>
        );
    }
}
