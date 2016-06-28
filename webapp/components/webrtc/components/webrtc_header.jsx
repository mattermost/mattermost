// Copyright (c) 2016 ZBox, Spa. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class WebrtcHeader extends React.Component {
    constructor(props) {
        super(props);

        this.handleClose = this.handleClose.bind(this);

        this.state = {
            username: Utils.displayUsername(this.props.userId)
        };
    }
    handleClose(e) {
        e.preventDefault();

        this.props.onClose();
    }
    render() {
        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    <FormattedMessage
                        id='webrtc.header'
                        defaultMessage='Video Call with {username}'
                        values={{
                            username: this.state.username
                        }}
                    />
                </span>
                <button
                    type='button'
                    className='sidebar--right__close'
                    aria-label='Close'
                    onClick={this.handleClose}
                >
                    <i className='fa fa-sign-out'/>
                </button>
            </div>
        );
    }
}

WebrtcHeader.propTypes = {
    userId: React.PropTypes.string.isRequired,
    onClose: React.PropTypes.func.isRequired
};
