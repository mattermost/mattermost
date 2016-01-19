// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import Constants from '../utils/constants.jsx';
import * as Utils from '../utils/utils.jsx';

var Tooltip = ReactBootstrap.Tooltip;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

const messages = defineMessages({
    at: {
        id: 'time_since.at',
        defaultMessage: ' at '
    },
    hours: {
        id: 'time_since.hours',
        defaultMessage: '@interval hours ago'
    },
    hour: {
        id: 'time_since.hour',
        defaultMessage: '1 hour ago'
    },
    minutes: {
        id: 'time_since.minutes',
        defaultMessage: '@interval minutes ago'
    },
    minute: {
        id: 'time_since.minute',
        defaultMessage: '1 minute ago'
    },
    justNow: {
        id: 'time_since.justNow',
        defaultMessage: 'just now'
    }
});

class TimeSince extends React.Component {
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
        const {formatMessage, locale} = this.props.intl;

        const displayDate = Utils.displayDate(this.props.eventTime, locale);
        const displayTime = Utils.displayTime(this.props.eventTime);

        const tooltip = (
            <Tooltip id={'time-since-tooltip-' + this.props.eventTime}>
                {displayDate + formatMessage(messages.at) + displayTime}
            </Tooltip>
        );

        const translations = {
            hours: formatMessage(messages.hours),
            hour: formatMessage(messages.hour),
            minutes: formatMessage(messages.minutes),
            minute: formatMessage(messages.minute),
            justNow: formatMessage(messages.justNow)
        };

        return (
            <OverlayTrigger
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={tooltip}
            >
                <time className='post__time'>
                    {Utils.displayDateTime(this.props.eventTime, translations)}
                </time>
            </OverlayTrigger>
        );
    }
}
TimeSince.defaultProps = {
    eventTime: 0
};

TimeSince.propTypes = {
    eventTime: React.PropTypes.number.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(TimeSince);