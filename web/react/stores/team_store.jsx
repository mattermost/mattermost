// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var BrowserStore = require('../stores/browser_store.jsx');

var CHANGE_EVENT = 'change';

var TeamStore = assign({}, EventEmitter.prototype, {
  emitChange: function() {
    this.emit(CHANGE_EVENT);
  },
  addChangeListener: function(callback) {
    this.on(CHANGE_EVENT, callback);
  },
  removeChangeListener: function(callback) {
    this.removeListener(CHANGE_EVENT, callback);
  },
  get: function(id) {
    var c = this._getTeams();
    return c[id];
  },
  getByName: function(name) {
    var current = null;
    var t = this._getTeams();

    for (id in t) {
        if (t[id].name == name) {
            return t[id];
        }
    }

    return null;
  },
  getAll: function() {
    return this._getTeams();
  },
  setCurrentId: function(id) {
    if (id == null)
      BrowserStore.removeItem("current_team_id");
    else
      BrowserStore.setItem("current_team_id", id);
  },
  getCurrentId: function() {
    return BrowserStore.getItem("current_team_id");
  },
  getCurrent: function() {
    var currentId = TeamStore.getCurrentId();

    if (currentId != null)
      return this.get(currentId);
    else
      return null;
  },
  getCurrentTeamUrl: function() {
      return window.location.origin + "/" + this.getCurrent().name;
  },
  storeTeam: function(team) {
      var teams = this._getTeams();
      teams[team.id] = team;
      this._storeTeams(teams);
  },
  _storeTeams: function(teams) {
    BrowserStore.setItem("user_teams", teams);
  },
  _getTeams: function() {
    return BrowserStore.getItem("user_teams", {});
  }
});

TeamStore.dispatchToken = AppDispatcher.register(function(payload) {
  var action = payload.action;

  switch(action.type) {

    case ActionTypes.CLICK_TEAM:
      TeamStore.setCurrentId(action.id);
      TeamStore.emitChange();
      break;

    case ActionTypes.RECIEVED_TEAM:
      TeamStore.storeTeam(action.team);
      TeamStore.emitChange();
      break;

    default:
  }
});

module.exports = TeamStore;
