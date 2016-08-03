// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class LoadingScreen extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        let message = (
            <FormattedMessage
                id='loading_screen.loading'
                defaultMessage='Loading'
            />
        );

        if (this.props.message) {
            message = this.props.message;
        }

        return (
            <div
                className='loading-screen'
                style={{position: this.props.position}}
            >
                <div className='loading__content'>
                    <h3>
                        {message}
                    </h3>
                    <div className='round round-1'></div>
                    <div className='round round-2'></div>
                    <div className='round round-3'></div>
                </div>
            </div>
        );
    }
}

LoadingScreen.defaultProps = {
    position: 'relative'
};
LoadingScreen.propTypes = {
    position: React.PropTypes.oneOf(['absolute', 'fixed', 'relative', 'static', 'inherit']),
    message: React.PropTypes.node
};
