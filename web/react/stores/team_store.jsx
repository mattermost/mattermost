// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var EventEmitter = require('events').EventEmitter;
var assign = require('object-assign');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;


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
      sessionStorage.removeItem("current_team_id");
    else
      sessionStorage.setItem("current_team_id", id);
  },
  getCurrentId: function() {
    return sessionStorage.getItem("current_team_id");
  },
  getCurrent: function() {
    var currentId = TeamStore.getCurrentId();

    if (currentId != null)
      return this.get(currentId);
    else
      return null;
  },
  storeTeam: function(team) {
    var teams = this._getTeams();
    teams[team.id] = team;
    this._storeTeams(teams);
  },
  _storeTeams: function(teams) {
    sessionStorage.setItem("user_teams", JSON.stringify(teams));
  },
  _getTeams: function() {
    var teams = {};

    try {
        teams = JSON.parse(sessionStorage.user_teams);
    }
    catch (err) {
    }

    return teams;
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
