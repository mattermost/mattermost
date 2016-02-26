// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ErrorStore from '../stores/error_store.jsx';

// import mm-intl is required for the tool to be able to extract the messages
import {defineMessages} from 'mm-intl';

var messages = defineMessages({
    preview: {
        id: 'error_bar.preview_mode',
        defaultMessage: 'Preview Mode: Email notifications have not been configured'
    }
});

export default class ErrorBar extends React.Component {
    constructor() {
        super();

        this.onErrorChange = this.onErrorChange.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = ErrorStore.getLastError();
    }

    static propTypes() {
        return {
            intl: ReactIntl.intlShape.isRequired
        };
    }

    isValidError(s) {
        if (!s) {
            return false;
        }

        if (!s.message) {
            return false;
        }

        return true;
    }

    componentWillMount() {
        if (global.window.mm_config.SendEmailNotifications === 'false') {
            ErrorStore.storeLastError({message: this.props.intl.formatMessage(messages.preview)});
            this.onErrorChange();
        }
    }

    componentDidMount() {
        ErrorStore.addChangeListener(this.onErrorChange);
    }

    componentWillUnmount() {
        ErrorStore.removeChangeListener(this.onErrorChange);
    }

    onErrorChange() {
        var newState = ErrorStore.getLastError();

        if (newState) {
            this.setState(newState);
        } else {
            this.setState({message: null});
        }
    }

    handleClose(e) {
        if (e) {
            e.preventDefault();
        }

        ErrorStore.clearLastError();
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

export default ReactIntl.injectIntl(ErrorBar);
