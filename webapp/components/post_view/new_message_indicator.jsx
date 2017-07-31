// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import Constants from 'utils/constants.jsx';
import {FormattedMessage} from 'react-intl';

export default class NewMessageIndicator extends React.PureComponent {
    static propTypes = {
        onClick: PropTypes.func.isRequired,
        newMessages: PropTypes.number
    }

    constructor(props) {
        super(props);
        this.state = {
            visible: false,
            rendered: false
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.newMessages > 0) {
            this.setState({rendered: true}, () => {
                this.setState({visible: true});
            });
        } else {
            this.setState({visible: false});
        }
    }

    render() {
        const unreadIcon = Constants.UNREAD_ICON_SVG;
        let className = 'new-messages__button';
        if (this.state.visible > 0) {
            className += ' visible';
        }
        if (!this.state.rendered) {
            className += ' disabled';
        }
        return (
            <div
                className={className}
                onTransitionEnd={this.setRendered.bind(this)}
                ref='indicator'
            >
                <div onClick={this.props.onClick}>
                    <FormattedMessage
                        id='posts_view.newMsgBelow'
                        defaultMessage='New {count, plural, one {message} other {messages}}'
                        values={{count: this.props.newMessages}}
                    />
                    <span
                        className='icon icon__unread'
                        dangerouslySetInnerHTML={{__html: unreadIcon}}
                    />
                </div>
            </div>
        );
    }

    // Sync 'rendered' state with visibility param, only after transitions
    // have ended
    setRendered() {
        this.setState({rendered: this.state.visible});
    }
}

NewMessageIndicator.defaultProps = {
    newMessages: 0
};
