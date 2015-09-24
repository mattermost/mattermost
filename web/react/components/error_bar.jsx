// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ErrorStore = require('../stores/error_store.jsx');

export default class ErrorBar extends React.Component {
    constructor() {
        super();

        this.onErrorChange = this.onErrorChange.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.prevTimmer = null;

        this.state = ErrorStore.getLastError();
        if (this.state && this.state.message) {
            this.prevTimmer = setTimeout(this.handleClose, 10000);
        }
    }

    componentDidMount() {
        ErrorStore.addChangeListener(this.onErrorChange);
        $('body').css('padding-top', $(React.findDOMNode(this)).outerHeight());
        $(window).resize(() => {
            if (this.state && this.state.message) {
                $('body').css('padding-top', $(React.findDOMNode(this)).outerHeight());
            }
        });
    }

    componentWillUnmount() {
        ErrorStore.removeChangeListener(this.onErrorChange);
    }

    onErrorChange() {
        var newState = ErrorStore.getLastError();

        if (this.prevTimmer != null) {
            clearInterval(this.prevTimmer);
            this.prevTimmer = null;
        }

        if (newState) {
            this.setState(newState);
            this.prevTimmer = setTimeout(this.handleClose, 10000);
        } else {
            this.setState({message: null});
        }
    }

    handleClose(e) {
        if (e) {
            e.preventDefault();
        }

        ErrorStore.storeLastError(null);
        ErrorStore.emitChange();

        $('body').css('padding-top', '0');
    }

    render() {
        if (!this.state) {
            return <div/>;
        }

        if (!this.state.message) {
            return <div/>;
        }

        if (this.state.connErrorCount < 7) {
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
