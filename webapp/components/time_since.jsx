// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

export default class TimeSince extends React.Component {
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
                {Utils.displayTimeFormatted(this.props.eventTime)}
            </time>
        );
    }
}

TimeSince.defaultProps = {
    eventTime: 0,
    sameUser: false
};

TimeSince.propTypes = {
    eventTime: React.PropTypes.number.isRequired,
    sameUser: React.PropTypes.bool,
    compactDisplay: React.PropTypes.bool
};
