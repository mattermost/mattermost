// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Constants from 'utils/constants.jsx';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import {FormattedTime} from 'react-intl';

export default class PostTime extends React.Component {
    constructor(props) {
        super(props);

        this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
    }

    componentDidMount() {
        this.intervalId = setInterval(() => {
            this.forceUpdate();
        }, Constants.TIME_SINCE_UPDATE_INTERVAL);
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    render() {
        return (
            <time className='post__time'>
                <FormattedTime
                    value={this.props.eventTime}
                    hour='2-digit'
                    minute='2-digit'
                    hour12={!this.props.useMilitaryTime}
                />
            </time>
        );
    }
}

PostTime.defaultProps = {
    eventTime: 0,
    sameUser: false
};

PostTime.propTypes = {
    eventTime: React.PropTypes.number.isRequired,
    sameUser: React.PropTypes.bool,
    compactDisplay: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired
};
