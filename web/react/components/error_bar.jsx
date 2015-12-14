// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import ErrorStore from '../stores/error_store.jsx';

const messages = defineMessages({
    webSocket: {
        id: 'error_bar.webSocket',
        defaultMessage: 'Please check connection, Mattermost unreachable. If issue persists, ask administrator to check WebSocket port.'
    }
});

class ErrorBar extends React.Component {
    constructor() {
        super();

        this.onErrorChange = this.onErrorChange.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = ErrorStore.getLastError();
    }

    isValidError(s) {
        if (!s) {
            return false;
        }

        if (!s.message) {
            return false;
        }

        if (s.connErrorCount && s.connErrorCount >= 1 && s.connErrorCount < 7) {
            return false;
        }

        return true;
    }

    isConnectionError(s) {
        if (!s.connErrorCount || s.connErrorCount === 0) {
            return false;
        }

        if (s.connErrorCount > 7) {
            return true;
        }

        return false;
    }

    componentDidMount() {
        ErrorStore.addChangeListener(this.onErrorChange);
    }

    componentWillUnmount() {
        ErrorStore.removeChangeListener(this.onErrorChange);
    }

    onErrorChange() {
        const {formatMessage} = this.props.intl;
        var newState = ErrorStore.getLastError();

        if (newState) {
            if (newState.message === 'webSocket') {
                newState.message = formatMessage(messages.webSocket);
            }
            this.setState(newState);
        } else {
            this.setState({message: null});
        }
    }

    handleClose(e) {
        if (e) {
            e.preventDefault();
        }

        this.setState({message: null});
    }

    render() {
        if (!this.isValidError(this.state)) {
            return <div/>;
        }

        return (
            <div className='error-bar'>
                <span>{this.state.message}</span>
                <a
                    href='#'
                    className='error-bar__close'
                    onClick={this.handleClose}
                >
                    &times;
                </a>
            </div>
        );
    }
}

ErrorBar.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(ErrorBar);