// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ErrorStore = require('../stores/error_store.jsx');
var utils = require('../utils/utils.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

export default class ErrorBar extends React.Component {
    constructor() {
        super();

        this.onErrorChange = this.onErrorChange.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = this.getStateFromStores();
        if (this.state.message) {
            setTimeout(this.handleClose, 10000);
        }
    }
    getStateFromStores() {
        var error = ErrorStore.getLastError();
        if (!error || error.message === 'There appears to be a problem with your internet connection') {
            return {message: null};
        }

        return {message: error.message};
    }
    componentDidMount() {
        ErrorStore.addChangeListener(this.onErrorChange);
        $('body').css('padding-top', $(React.findDOMNode(this)).outerHeight());
        $(window).resize(function onResize() {
            if (this.state.message) {
                $('body').css('padding-top', $(React.findDOMNode(this)).outerHeight());
            }
        }.bind(this));
    }
    componentWillUnmount() {
        ErrorStore.removeChangeListener(this.onErrorChange);
    }
    onErrorChange() {
        var newState = this.getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            if (newState.message) {
                setTimeout(this.handleClose, 10000);
            }

            this.setState(newState);
        }
    }
    handleClose(e) {
        if (e) {
            e.preventDefault();
        }

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_ERROR,
            err: null
        });

        $('body').css('padding-top', '0');
    }
    render() {
        if (this.state.message) {
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

        return <div/>;
    }
}
