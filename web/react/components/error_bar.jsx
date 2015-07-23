// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ErrorStore = require('../stores/error_store.jsx');
var utils = require('../utils/utils.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

function getStateFromStores() {
    var error = ErrorStore.getLastError();
    if (error && error.message !== "There appears to be a problem with your internet connection") {
        return { message: error.message };
    } else {
        return { message: null };
    }
}

module.exports = React.createClass({
    displayName: 'ErrorBar',

    componentDidMount: function() {
        ErrorStore.addChangeListener(this._onChange);
        $('body').css('padding-top', $(React.findDOMNode(this)).outerHeight());
        $(window).resize(function() {
            if (this.state.message) {
                $('body').css('padding-top', $(React.findDOMNode(this)).outerHeight());
            }
        }.bind(this));
    },
    componentWillUnmount: function() {
        ErrorStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            if (newState.message) {
                setTimeout(this.handleClose, 10000);
            }

            this.setState(newState);
        }
    },
    handleClose: function(e) {
        if (e) e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_ERROR,
            err: null
        });

        $('body').css('padding-top', '0');
    },
    getInitialState: function() {
        var state = getStateFromStores();
        if (state.message) {
            setTimeout(this.handleClose, 10000);
        }
        return state;
    },
    render: function() {
        if (this.state.message) {
            return (
                <div className="error-bar">
                    <span>{this.state.message}</span>
                    <a href="#" className="error-bar__close" onClick={this.handleClose}>&times;</a>
                </div>
            );
        } else {
            return <div/>;
        }
    }
});