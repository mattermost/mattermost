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
        }, 30000);
    }
    componentWillUnmount() {
        clearInterval(this.intervalId);
    }
    render() {
        const displayDate = Utils.displayDate(this.props.eventTime);
        const displayTime = Utils.displayTime(this.props.eventTime);

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
    eventTime: 0
};

TimeSince.propTypes = {
    eventTime: React.PropTypes.number.isRequired
};
