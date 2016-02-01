// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from '../utils/constants.jsx';
import * as Utils from '../utils/utils.jsx';

var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class TimeSince extends React.Component {
    constructor(props) {
        super(props);
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
        const displayDate = Utils.displayDate(this.props.eventTime);
        const displayTime = Utils.displayTime(this.props.eventTime);

        if (this.props.sameUser) {
            return (
                <time className='post__time'>
                    {Utils.displayTime(this.props.eventTime)}
                </time>
            );
        }

        const tooltip = (
            <Tooltip id={'time-since-tooltip-' + this.props.eventTime}>
                {displayDate + ' at ' + displayTime}
            </Tooltip>
        );

        return (
            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={tooltip}
            >
                <time className='post__time'>
                    {Utils.displayDateTime(this.props.eventTime)}
                </time>
            </OverlayTrigger>
        );
    }
}

TimeSince.defaultProps = {
    eventTime: 0,
    sameUser: false
};

TimeSince.propTypes = {
    eventTime: React.PropTypes.number.isRequired,
    sameUser: React.PropTypes.bool
};
