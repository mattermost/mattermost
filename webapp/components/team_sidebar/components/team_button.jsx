// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';

import React from 'react';
import {Link} from 'react-router/es6';
import {Tooltip, OverlayTrigger} from 'react-bootstrap';

export default class TeamButton extends React.Component {
    constructor(props) {
        super(props);

        this.handleDisabled = this.handleDisabled.bind(this);
    }

    handleDisabled(e) {
        e.preventDefault();
    }

    render() {
        let teamClass = this.props.active ? 'active' : '';
        const disabled = this.props.disabled ? 'team-disabled' : '';
        const handleClick = (this.props.active || this.props.disabled) ? this.handleDisabled : null;
        let badge;

        if (!teamClass) {
            teamClass = this.props.unread ? 'unread' : '';

            if (this.props.mentions) {
                badge = (
                    <span className='badge pull-right small'>{this.props.mentions}</span>
                );
            }
        }

        return (
            <div
                className={`team-container ${teamClass}`}
                key={this.props.key}
            >
                <Link
                    className={disabled}
                    to={this.props.url}
                    onClick={handleClick}
                >
                    <OverlayTrigger
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        placement={this.props.placement}
                        overlay={
                            <Tooltip id={`tooltip-${this.props.key}`}>
                                {this.props.tip}
                            </Tooltip>
                        }
                    >
                        <div className='team-btn'>
                            {badge}
                            {this.props.contents}
                        </div>
                    </OverlayTrigger>
                </Link>
            </div>
        );
    }
}

TeamButton.defaultProps = {
    tip: '',
    placement: 'right',
    active: false,
    disabled: false,
    unread: false,
    mentions: 0
};

TeamButton.propTypes = {
    key: React.PropTypes.string.isRequired,
    url: React.PropTypes.string.isRequired,
    contents: React.PropTypes.element.isRequired,
    tip: React.PropTypes.element,
    active: React.PropTypes.bool,
    disabled: React.PropTypes.bool,
    unread: React.PropTypes.bool,
    mentions: React.PropTypes.number,
    placement: React.PropTypes.oneOf(['left', 'right', 'top', 'bottom'])
};
