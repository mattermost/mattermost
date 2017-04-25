// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {Link} from 'react-router/es6';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';
import {Constants} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

export default class SelectTeamItem extends React.Component {
    static propTypes = {
        team: React.PropTypes.object.isRequired,
        url: React.PropTypes.string.isRequired,
        onTeamClick: React.PropTypes.func.isRequired,
        loading: React.PropTypes.bool.isRequired
    };

    constructor(props) {
        super(props);

        this.handleTeamClick = this.handleTeamClick.bind(this);
    }

    handleTeamClick() {
        this.props.onTeamClick(this.props.team);
    }

    render() {
        let icon;
        const infoIcon = Constants.TEAM_INFO_SVG;
        if (this.props.loading) {
            icon = (
                <span className='fa fa-refresh fa-spin right signup-team__icon'/>
            );
        } else {
            icon = (
                <span className='fa fa-angle-right right signup-team__icon'/>
            );
        }

        var descriptionTooltip = '';
        var showDescriptionTooltip = '';
        if (this.props.team.description) {
            descriptionTooltip = (
                <Tooltip id='team-description__tooltip'>
                    {this.props.team.description}
                </Tooltip>
            );

            showDescriptionTooltip = (
                <OverlayTrigger
                    trigger={['hover', 'focus', 'click']}
                    delayShow={1000}
                    placement='top'
                    overlay={descriptionTooltip}
                    ref='descriptionOverlay'
                >
                    <span
                        className='icon icon--info'
                        dangerouslySetInnerHTML={{__html: infoIcon}}
                    />
                </OverlayTrigger>
            );
        }

        return (
            <div className='signup-team-dir'>
                {showDescriptionTooltip}
                <Link
                    id={Utils.createSafeId(this.props.team.display_name)}
                    to={this.props.url}
                    onClick={this.handleTeamClick}
                >
                    <span className='signup-team-dir__name'>{this.props.team.display_name}</span>
                    {icon}
                </Link>
            </div>
        );
    }
}
