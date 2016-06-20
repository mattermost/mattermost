/**
 * Created by enahum on 3/25/16.
 */

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class ConnectingScreen extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        return (
            <div
                className='loading-screen'
                style={{position: this.props.position}}
            >
                <div className='loading__content'>
                    <h3>
                        <FormattedMessage
                            id='connecting_screen'
                            defaultMessage='Connecting'
                        />
                    </h3>
                    <div className='round round-1'></div>
                    <div className='round round-2'></div>
                    <div className='round round-3'></div>
                </div>
            </div>
        );
    }
}

ConnectingScreen.defaultProps = {
    position: 'relative'
};
ConnectingScreen.propTypes = {
    position: React.PropTypes.oneOf(['absolute', 'fixed', 'relative', 'static', 'inherit'])
};
