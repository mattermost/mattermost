// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
import {getDateForUnixTicks, isMobile, updateWindowDimensions} from 'utils/utils.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router/es6';
import TeamStore from 'stores/team_store.jsx';

export default class PostTime extends React.PureComponent {
    static propTypes = {

        /*
         * The time to display
         */
        eventTime: PropTypes.number.isRequired,

        /*
         * Set to display using 24 hour format
         */
        useMilitaryTime: PropTypes.bool,

        /*
         * The post id of posting being rendered
         */
        postId: PropTypes.string
    }

    static defaultProps = {
        eventTime: 0,
        useMilitaryTime: false
    }

    constructor(props) {
        super(props);

        this.state = {
            currentTeamDisplayName: TeamStore.getCurrent().name,
            width: '',
            height: ''
        };
    }

    componentDidMount() {
        this.intervalId = setInterval(() => {
            this.forceUpdate();
        }, Constants.TIME_SINCE_UPDATE_INTERVAL);
        window.addEventListener('resize', () => {
            updateWindowDimensions(this);
        });
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
        window.removeEventListener('resize', () => {
            updateWindowDimensions(this);
        });
    }

    renderTimeTag() {
        const date = getDateForUnixTicks(this.props.eventTime);

        return (
            <time
                className='post__time'
                dateTime={date.toISOString()}
                title={date}
            >
                {date.toLocaleString('en', {hour: '2-digit', minute: '2-digit', hour12: !this.props.useMilitaryTime})}
            </time>
        );
    }

    render() {
        if (isMobile()) {
            return this.renderTimeTag();
        }

        return (
            <Link
                to={`/${this.state.currentTeamDisplayName}/pl/${this.props.postId}`}
                target='_blank'
                className='post__permalink'
            >
                {this.renderTimeTag()}
            </Link>
        );
    }
}
