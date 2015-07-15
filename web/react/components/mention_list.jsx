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

        $('body').on('keydown.mentionlist', '#'+this.props.id,
            function(e) {
                if (!self.isEmpty() && self.state.mentionText != '-1' && (e.which === 13 || e.which === 9)) {
                    e.stopPropagation();
                    e.preventDefault();
                    self.addCurrentMention();
                }
                else if (!self.isEmpty() && self.state.mentionText != '-1' && (e.which === 38 || e.which === 40)) {
                    e.stopPropagation();
                    e.preventDefault();

                    var tempSelectedMention = -1

                    if (!self.getSelection(self.state.selectedMention)) {
                        while (self.getSelection(++tempSelectedMention)) {
                            if (self.state.selectedUsername === self.refs['mention' + tempSelectedMention].props.username) {
                                this.refs['mention' + tempSelectedMention].select();
                                this.setState({ selectedMention: tempSelectedMention });
                                break;
                            }
                        }
                    }
                    else {
                        self.refs['mention' + self.state.selectedMention].deselect();
                        if (e.which === 38) {    
                            if (self.getSelection(self.state.selectedMention - 1))
                                self.setState({ selectedMention: self.state.selectedMention - 1, selectedUsername: self.refs['mention' + (self.state.selectedMention - 1)].props.username });
                            else {
                                while (self.getSelection(++tempSelectedMention))
                                    ; //Need to find the top of the list
                                self.setState({ selectedMention: tempSelectedMention - 1, selectedUsername: self.refs['mention' + (tempSelectedMention - 1)].props.username });
                            }
                        }
                        else {
                            if (self.getSelection(self.state.selectedMention + 1))
                                self.setState({ selectedMention: self.state.selectedMention + 1, selectedUsername: self.refs['mention' + (self.state.selectedMention + 1)].props.username });
                            else
                                self.setState({ selectedMention: 0, selectedUsername: self.refs.mention0.props.username });
                        }
                    }
                    self.refs['mention' + self.state.selectedMention].select();

                    self.scrollToMention(e.which, tempSelectedMention);
                }
                else if (e.which === 46 || e.which === 8) {
                    self.setState({ lessText: true });
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
        $('body').off('keydown.mentionlist', '#'+this.props.id);
    },
    componentWillUpdate: function() {
        if (this.state.mentionText != "-1" && this.getSelection(this.state.selectedMention)) {
            this.refs['mention' + this.state.selectedMention].deselect();
        }
    },
    componentDidUpdate: function() {
        if (this.state.mentionText != "-1") {
            if (this.state.selectedUsername !== "" && (!this.getSelection(this.state.selectedMention) || this.state.selectedUsername !== this.refs['mention' + this.state.selectedMention].props.username)) {
                var tempSelectedMention = -1;
                var foundMatch = false;
                while (!this.state.lessText && this.getSelection(++tempSelectedMention)) {
                    if (this.state.selectedUsername === this.refs['mention' + tempSelectedMention].props.username) {
                        this.refs['mention' + tempSelectedMention].select();
                        this.setState({ selectedMention: tempSelectedMention });
                        foundMatch = true;
                        break;
                    }
                }
                if (this.refs.mention0 != undefined && !foundMatch) {
                    this.refs.mention0.select();
                    this.setState({ selectedMention: 0, selectedUsername: this.refs.mention0.props.username, lessText: false });
                }
            }
            else if (this.refs['mention' + this.state.selectedMention] != undefined) {
                this.refs['mention' + this.state.selectedMention].select();
            }
        }
        else if (this.state.selectedMention !== 0) {
            this.setState({ selectedMention: 0, selectedUsername: "" });
        }
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
    handleMouseEnter: function(listId) {
        if (this.getSelection(this.state.selectedMention)) {
            this.refs['mention' + this.state.selectedMention].deselect();
        }
        this.setState({ selectedMention: listId, selectedUsername: this.refs['mention' + listId].props.username });
        this.refs['mention' + listId].select();
    },
    getSelection: function(listId) {
        var mention = this.refs['mention' + listId];
        if (!mention) 
            return false;
        else
            return true;
    },
    addCurrentMention: function() {
        if (!this.refs['mention' + this.state.selectedMention]) 
            this.addFirstMention();
        else
            this.refs['mention' + this.state.selectedMention].handleClick();
    },
    addFirstMention: function() {
        if (!this.refs.mention0) return;
        this.refs.mention0.handleClick();
    },
    isEmpty: function() {
        return (!this.refs.mention0);
    },
    scrollToMention: function(keyPressed, ifLoopUp) {
        var direction = keyPressed === 38 ? "up" : "down";
        var scrollAmount = 0;

        if (direction === "up" && ifLoopUp !== -1)
            scrollAmount = $("#mentionsbox").innerHeight() + 10000000; //innerHeight is not the real height of the box in the RHS sometimes; this compensates as it should always go to the bottom anyway
        else if (direction === "down" && this.refs['mention' + this.state.selectedMention].props.listId === 0)
            scrollAmount = 0;
        else if (direction === "up") 
            scrollAmount = "-=" + ($('#'+this.refs['mention' + this.state.selectedMention].props.id +"_mentions").innerHeight() - 5);
        else if (direction === "down")
            scrollAmount = "+=" + ($('#'+this.refs['mention' + this.state.selectedMention].props.id +"_mentions").innerHeight() - 5);

        $("#mentionsbox").animate({
            scrollTop: scrollAmount
        }, 50);
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
        return { excludeUsers: [], mentionText: "-1", selectedMention: 0, selectedUsername: "", lessText: false };
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
        all.id = "allmention";
        users.push(all);

        var channel = {};
        channel.username = "channel";
        channel.full_name = "";
        channel.secondary_text = "Notifies everyone in the channel";
        channel.id = "channelmention";
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
                mentions[index] = (
                    <Mention
                        ref={'mention' + index}
                        username={users[i].username}
                        secondary_text={users[i].secondary_text}
                        id={users[i].id}
                        listId={index}
                        isFocus={this.state.selectedMention === index ? true : false}
                        handleMouseEnter={this.handleMouseEnter}
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
                <div ref="mentionlist" className="mentions-box" id="mentionsbox">
                    { mentions }
                </div>
            </div>
        );
    }
});
