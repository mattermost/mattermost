// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// Indicator for the left sidebar which indicate if there's unread posts in a channel that is not shown
// because it is either above or below the screen
export default class UnreadChannelIndicator extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        let displayValue = 'none';
        if (this.props.show) {
            displayValue = 'initial';
        }
        return (
            <div
                className={'nav-pills__unread-indicator ' + this.props.extraClass}
                style={{display: displayValue}}
            >
                {this.props.text}
            </div>
        );
    }
}

UnreadChannelIndicator.defaultProps = {
    show: false,
    extraClass: '',
    text: ''
};
UnreadChannelIndicator.propTypes = {
    show: React.PropTypes.bool,
    extraClass: React.PropTypes.string,
    text: React.PropTypes.string
};
