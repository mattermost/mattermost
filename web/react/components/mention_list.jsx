// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Mention = require('./mention.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

module.exports = React.createClass({
    componentDidMount: function() {
        PostStore.addMentionDataChangeListener(this._onChange);

        var self = this;
        $('#'+this.props.id).on('keypress.mentionlist',
            function(e) {
                if (!self.isEmpty() && self.state.mentionText != '-1' && e.which === 13) {
                    e.stopPropagation();
                    e.preventDefault();
                    self.addFirstMention();
                }
            }
        );
    },
    componentWillUnmount: function() {
        PostStore.removeMentionDataChangeListener(this._onChange);
        $('#'+this.props.id).off('keypress.mentionlist');
    },
    _onChange: function(id, mentionText, excludeList) {
        if (id !== this.props.id) return;

        var newState = this.state;
        if (mentionText != null) newState.mentionText = mentionText;
        if (excludeList != null) newState.excludeUsers = excludeList;
        this.setState(newState);
    },
    handleClick: function(name) {
        AppDispatcher.handleViewAction({
            type: ActionTypes.RECIEVED_ADD_MENTION,
            id: this.props.id,
            username: name
        });

        this.setState({ mentionText: '-1' });
    },
    addFirstMention: function() {
        if (!this.refs.mention0) return;
        this.refs.mention0.handleClick();
    },
    isEmpty: function() {
        return (!this.refs.mention0);
    },
    alreadyMentioned: function(username) {
        var excludeUsers = this.state.excludeUsers;
        for (var i = 0; i < excludeUsers.length; i++) {
            if (excludeUsers[i] === username) {
                return true;
            }
        }
        return false;
    },
    getInitialState: function() {
        return { excludeUsers: [], mentionText: "-1" };
    },
    render: function() {
        var mentionText = this.state.mentionText;
        if (mentionText === '-1') return (<div/>);

        var profiles = UserStore.getActiveOnlyProfiles();
        var users = [];
        for (var id in profiles) {
            users.push(profiles[id]);
        }

        var all = {};
        all.username = "all";
        all.full_name = "";
        all.secondary_text = "Notifies everyone in the team";
        users.push(all);

        var channel = {};
        channel.username = "channel";
        channel.full_name = "";
        channel.secondary_text = "Notifies everyone in the channel";
        users.push(channel);

        users.sort(function(a,b) {
            if (a.username < b.username) return -1;
            if (a.username > b.username) return 1;
            return 0;
        });
        var mentions = {};
        var index = 0;

        for (var i = 0; i < users.length; i++) {
            if (Object.keys(mentions).length >= 25) break;
            if (this.alreadyMentioned(users[i].username)) continue;

            var firstName = "", lastName = "";
            if (users[i].full_name.length > 0) {
                var splitName = users[i].full_name.split(' ');
                firstName = splitName[0].toLowerCase();
                lastName = splitName.length > 1 ? splitName[splitName.length-1].toLowerCase() : "";
                users[i].secondary_text = users[i].full_name;
            }

            if (firstName.lastIndexOf(mentionText,0) === 0
                    || lastName.lastIndexOf(mentionText,0) === 0 || users[i].username.lastIndexOf(mentionText,0) === 0) {
                mentions[i+1] = (
                    <Mention
                        ref={'mention' + index}
                        username={users[i].username}
                        secondary_text={users[i].secondary_text}
                        id={users[i].id}
                        handleClick={this.handleClick} />
                );
                index++;
            }
        }
        var numMentions = Object.keys(mentions).length;

        if (numMentions < 1) return (<div/>);

        var height = (numMentions*37) + 2;
        var width = $('#'+this.props.id).parent().width();
        var bottom = $(window).height() - $('#'+this.props.id).offset().top;
        var left = $('#'+this.props.id).offset().left;
        var max_height = $('#'+this.props.id).offset().top - 10;

        return (
            <div className="mentions--top" style={{height: height, width: width, bottom: bottom, left: left}}>
                <div ref="mentionlist" className="mentions-box" style={{maxHeight: max_height, height: height, width: width}}>
                    { mentions }
                </div>
            </div>
        );
    }
});
