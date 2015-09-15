// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

// Indicators for the left sidebar which indicate if there's unread posts in a channel that is not shown
// because it is either above or below the screen
export default class UnreadChannelIndicators extends React.Component {
    constructor(props) {
        super(props);

        this.getFirstLastUnreadChannels = this.getFirstLastUnreadChannels.bind(this);
        this.onParentUpdate = this.onParentUpdate.bind(this);

        this.state = this.getFirstLastUnreadChannels(props);
    }

    getFirstLastUnreadChannels(props) {
        let firstUnreadChannel = null;
        let lastUnreadChannel = null;

        for (const unreadChannel of props.unreadChannels) {
            if (!firstUnreadChannel) {
                firstUnreadChannel = unreadChannel;
            }
            lastUnreadChannel = unreadChannel;
        }

        return {
            firstUnreadChannel,
            lastUnreadChannel
        };
    }

    onParentUpdate(parentRefs) {
        const container = $(React.findDOMNode(parentRefs.container));
        const topUnreadIndicator = $(React.findDOMNode(this.refs.topIndicator));
        const bottomUnreadIndicator = $(React.findDOMNode(this.refs.bottomIndicator));

        if (this.state.firstUnreadChannel) {
            var firstUnreadElement = $(React.findDOMNode(parentRefs[this.state.firstUnreadChannel.name]));

            if (firstUnreadElement.position().top + firstUnreadElement.height() < 0) {
                topUnreadIndicator.css('display', 'initial');
            } else {
                topUnreadIndicator.css('display', 'none');
            }
        } else {
            topUnreadIndicator.css('display', 'none');
        }

        if (this.state.lastUnreadChannel) {
            var lastUnreadElement = $(React.findDOMNode(parentRefs[this.state.lastUnreadChannel.name]));

            if (lastUnreadElement.position().top > container.height()) {
                bottomUnreadIndicator.css('display', 'initial');
            } else {
                bottomUnreadIndicator.css('display', 'none');
            }
        } else {
            bottomUnreadIndicator.css('display', 'none');
        }
    }

    componentWillReceiveProps(nextProps) {
        this.setState(this.getFirstLastUnreadChannels(nextProps));
    }

    render() {
        return (
            <div>
                <div
                    ref='topIndicator'
                    className='nav-pills__unread-indicator nav-pills__unread-indicator-top'
                    style={{display: 'none'}}
                >
                    {'Unread post(s) above'}
                </div>
                <div
                    ref='bottomIndicator'
                    className='nav-pills__unread-indicator nav-pills__unread-indicator-bottom'
                    style={{display: 'none'}}
                >
                    {'Unread post(s) below'}
                </div>
            </div>
        );
    }
}

UnreadChannelIndicators.propTypes = {

    // a list of the unread channels displayed in the parent
    unreadChannels: React.PropTypes.array.isRequired
};
