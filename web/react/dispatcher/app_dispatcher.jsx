// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Dispatcher = require('flux').Dispatcher;
var assign = require('object-assign');

var Constants = require('../utils/constants.jsx');
var PayloadSources = Constants.PayloadSources;

var AppDispatcher = assign(new Dispatcher(), {
    handleServerAction: function performServerAction(action) {
        var payload = {
            source: PayloadSources.SERVER_ACTION,
            action: action
        };
        this.dispatch(payload);
    },

    handleViewAction: function performViewAction(action) {
        var payload = {
            source: PayloadSources.VIEW_ACTION,
            action: action
        };
        this.dispatch(payload);
    }
});

module.exports = AppDispatcher;
