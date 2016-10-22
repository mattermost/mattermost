// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import React from 'react';
import {FormattedMessage} from 'react-intl';

export default class NewMessageIndicator extends React.Component {
    render() {
        let className = 'nav-pills__unread-indicator-bottom';
        if (this.props.newMessages > 0) {
            className += ' visible';
        }
        return (
            <div
                className={className}
                onClick={this.props.onClick}
            >
                <span>
                    <i
                        className='fa fa-arrow-circle-o-down'
                    />
                    <FormattedMessage
                        id='posts_view_newMsgBelow'
                        defaultMessage='{count, number} new messages below'
                        values={{count: this.props.newMessages}}
                    />
                </span>
            </div>
        );
    }
}
NewMessageIndicator.defaultProps = {
    newMessages: 0
};

NewMessageIndicator.propTypes = {
    onClick: React.PropTypes.func.isRequired,
    newMessages: React.PropTypes.number
};
