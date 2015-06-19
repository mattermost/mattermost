// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Mention = require('./mention.jsx');

var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var MAX_HEIGHT_LIST = 292;
var MAX_ITEMS_IN_LIST = 25;
var ITEM_HEIGHT = 36;

module.exports = React.createClass({
    displayName: "MentionList",
    componentDidMount: function() {
        PostStore.addMentionDataChangeListener(this._onChange);

        var self = this;
        $('body').on('keypress.mentionlist', '#'+this.props.id,
            function(e) {
                if (!self.isEmpty() && self.state.mentionText != '-1' && e.which === 13) {
                    e.stopPropagation();
                    e.preventDefault();
                    self.addFirstMention();
                }
            }
        );
        $(document).click(function(e) {
            if (!($('#'+self.props.id).is(e.target) || $('#'+self.props.id).has(e.target).length ||
                ('mentionlist' in self.refs && $(self.refs['mentionlist'].getDOMNode()).has(e.target).length))) {
                self.setState({mentionText: "-1"})
            }
        });
    },
    componentWillUnmount: function() {
        PostStore.removeMentionDataChangeListener(this._onChange);
        $('body').off('keypress.mentionlist', '#'+this.props.id);
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
    handleKeyDown: function(e) {
        var selectedMention = this.state.selectedMention ? this.state.selectedMention : 1;

        // Need to be able to know number of mentions, use in conditionals & still
        // need to figure out how to highlight the mention I want every time.
        // Remember separate Mention Ref within for, second if statement in render
        // Maybe have the call there instead? Ehhh maybe not but need that to be able
        // to "select" it maybe...
        if (e.key === "ArrowUp") {
            selectedMention = selectedMention === ? 1 : selectedMention++;
        } 
        else if (e.key === "ArrowDown") {
            selectedMention = selectedMention === 1 ? : selectedMention--;
        }
        this.setState({selectedMention: selectedMention});
    }
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
        if (mentionText === '-1') return null;

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

        for (var i = 0; i < users.length && index < MAX_ITEMS_IN_LIST; i++) {
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

        if (numMentions < 1) return null;

        var $mention_tab = $('#'+this.props.id);
        var maxHeight = Math.min(MAX_HEIGHT_LIST, $mention_tab.offset().top - 10);
        var style = {
            height: Math.min(maxHeight, (numMentions*ITEM_HEIGHT) + 4),
            width:  $mention_tab.parent().width(),
            bottom: $(window).height() - $mention_tab.offset().top,
            left:   $mention_tab.offset().left
        };

        return (
            <div className="mentions--top" style={style}>
                <div ref="mentionlist" className="mentions-box" onKeyDown={this.handleKeyDown}>
                    { mentions }
                </div>
            </div>
        );
    }
});
