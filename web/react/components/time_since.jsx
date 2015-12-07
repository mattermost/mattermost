// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';

var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class TimeSince extends React.Component {
    constructor(props) {
        super(props);
    }
    componentDidMount() {
        if (TimeSince.instances == 0) {
          TimeSince.intervalId = setInterval(() => {
              TimeSince.children.map((elem) => elem.forceUpdate());
          }, 30000);
        }

        TimeSince.children.push(this)
        TimeSince.instances++;
    }
    componentWillUnmount() {
        // not called very often as channels are kept in background

        TimeSince.instances--;

        var index = TimeSince.children.indexOf(this);
        if (index > -1) {
          TimeSince.children.splice(index,1)
        }

        if (TimeSince.instances == 0 && TimeSince.intervalId > 0) {
          clearInterval(TimeSince.intervalId);
        }
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
                delayShow={400}
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
TimeSince.instances = 0
TimeSince.intervalId = 0
TimeSince.children = []
TimeSince.defaultProps = {
    eventTime: 0
};

TimeSince.propTypes = {
    eventTime: React.PropTypes.number.isRequired
};
