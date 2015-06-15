// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ErrorStore = require('../stores/error_store.jsx');
var utils = require('../utils/utils.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

function getStateFromStores() {
  var error = ErrorStore.getLastError();
  if (error) {
      return { message: error.message };
  } else {
     return { message: null };
  }
}

module.exports = React.createClass({
    componentDidMount: function() {
        ErrorStore.addChangeListener(this._onChange);
        $('body').css('padding-top', $('#error_bar').outerHeight());
        $(window).resize(function(){
            $('body').css('padding-top', $('#error_bar').outerHeight());
        });
    },
    componentWillUnmount: function() {
        ErrorStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        var newState = getStateFromStores();
        if (!utils.areStatesEqual(newState, this.state)) {
            if (newState.message) {
                var self = this;
                setTimeout(function(){self.handleClose();}, 10000);
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
            var self = this;
            setTimeout(function(){self.handleClose();}, 10000);
        }
        return state;
    },
    render: function() {
        var message = this.state.message;
        if (message) {
            return (
                <div className="error-bar">
                    <span className="error-text">{message}</span>
                    <a href="#" className="error-close pull-right" onClick={this.handleClose}>×</a>
                </div>
            );
        } else {
            return <div/>;
        }
    }
});
