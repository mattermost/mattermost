// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var UserStore = require('../stores/user_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var MsgTyping = require('./msg_typing.jsx');
var MentionList = require('./mention_list.jsx');
var CommandList = require('./command_list.jsx');

var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

module.exports = React.createClass({
    caret: -1,
    addedMention: false,
    doProcessMentions: false,
    mentions: [],
    componentDidMount: function() {
        PostStore.addAddMentionListener(this._onChange);

        this.resize();
        this.processMentions();
        this.updateTextdiv();
    },
    componentWillUnmount: function() {
        PostStore.removeAddMentionListener(this._onChange);
    },
    _onChange: function(id, username) {
        if (id !== this.props.id) return;
        this.addMention(username);
    },
    componentDidUpdate: function() {
        if (this.caret >= 0) {
            utils.setCaretPosition(this.refs.message.getDOMNode(), this.caret)
            this.caret = -1;
        }
        if (this.doProcessMentions) {
            this.processMentions();
            this.doProcessMentions = false;
        }
        this.updateTextdiv();
        this.resize();
    },
    componentWillReceiveProps: function(nextProps) {
        if (!this.addedMention) {
            this.checkForNewMention(nextProps.messageText);
        }
        var text = this.refs.message.getDOMNode().value;
        if (nextProps.channelId != this.props.channelId || nextProps.messageText !== text) {
            this.doProcessMentions = true;
        }
        this.addedMention = false;
        this.refs.commands.getSuggestedCommands(nextProps.messageText);
        this.resize();
    },
    getInitialState: function() {
        return { mentionText: '-1', mentions: [] };
    },
    updateMentionTab: function(mentionText, excludeList) {
        var self = this;
        // using setTimeout so dispatch isn't called during an in progress dispatch
        setTimeout(function() {
            AppDispatcher.handleViewAction({
                type: ActionTypes.RECIEVED_MENTION_DATA,
                id: self.props.id,
                mention_text: mentionText,
                exclude_list: excludeList
            });
        }, 1);
    },
    updateTextdiv: function() {
        var html = utils.insertHtmlEntities(this.refs.message.getDOMNode().value);
        for (var k in this.mentions) {
            var m = this.mentions[k];
            var re = new RegExp('( |^)@' + m + '( |$|\n)', 'm');
            html = html.replace(re, '$1<span class="mention">@'+m+'</span>$2');
        }
        var re2 = new RegExp('(^$)(?![.\n])', 'gm');
        html = html.replace(re2, '<br/><br/>');
        $(this.refs.textdiv.getDOMNode()).html(html);
    },
    handleChange: function() {
        this.props.onUserInput(this.refs.message.getDOMNode().value);
        this.resize();
    },
    handleKeyPress: function(e) {
        var text = this.refs.message.getDOMNode().value;

        if (!this.refs.commands.isEmpty() && text.indexOf("/") == 0 && e.which==13) {
            this.refs.commands.addFirstCommand();
            e.preventDefault();
            return;
        }

        if ( !this.doProcessMentions) {
            var caret = utils.getCaretPosition(this.refs.message.getDOMNode());
            var preText = text.substring(0, caret);
            var lastSpace = preText.lastIndexOf(' ');
            var lastAt = preText.lastIndexOf('@');

            if (caret > lastAt && lastSpace < lastAt) {
                this.doProcessMentions = true;
            }
        }

        this.props.onKeyPress(e);
    },
    handleKeyDown: function(e) {
        if (utils.getSelectedText(this.refs.message.getDOMNode()) !== '') {
            this.doProcessMentions = true;
        }

        if (e.keyCode === 8) {
            this.handleBackspace(e);
        }
    },
    handleBackspace: function(e) {
        var text = this.refs.message.getDOMNode().value;
        if (text.indexOf("/") == 0) {
            this.refs.commands.getSuggestedCommands(text.substring(0, text.length-1));
        }

        if (this.doProcessMentions) return;

        var caret = utils.getCaretPosition(this.refs.message.getDOMNode());
        var preText = text.substring(0, caret);
        var lastSpace = preText.lastIndexOf(' ');
        var lastAt = preText.lastIndexOf('@');

        if (caret > lastAt && (lastSpace > lastAt || lastSpace === -1)) {
            this.doProcessMentions = true;
        }
    },
    processMentions: function() {
        /* First, find all the possible mentions, highlight them in the HTML and add
            them all to a list of mentions */
        var text = utils.insertHtmlEntities(this.refs.message.getDOMNode().value);

        var profileMap = UserStore.getProfilesUsernameMap();

        var re1 = /@([a-z0-9_]+)( |$|\n)/gi;

        var matches = text.match(re1);

        if (!matches) {
            $(this.refs.textdiv.getDOMNode()).text(text);
            this.updateMentionTab(null, []);
            this.mentions = [];
            return;
        }

        var mentions = [];
        for (var i = 0; i < matches.length; i++) {
            var m = matches[i].substring(1,matches[i].length).trim();
            if ((m in profileMap && mentions.indexOf(m) === -1) || Constants.SPECIAL_MENTIONS.indexOf(m) !== -1) {
                mentions.push(m);
            }
        }

        /* Figure out what the user is currently typing. If it's a mention then we don't
            want to highlight it and add it to the mention list yet, so we remove it if
            there is only one occurence of that mention so far. */
        var caret = utils.getCaretPosition(this.refs.message.getDOMNode());

        var text = this.props.messageText;

        var preText = text.substring(0, caret);

        var atIndex = preText.lastIndexOf('@');
        var spaceIndex = preText.lastIndexOf(' ');
        var newLineIndex = preText.lastIndexOf('\n');

        var typingMention = "";
        if (atIndex > spaceIndex && atIndex > newLineIndex) {

            typingMention = text.substring(atIndex+1, caret);
        }

        var re3 = new RegExp('@' + typingMention + '( |$|\n)', 'g');

        if ((text.match(re3) || []).length === 1 && mentions.indexOf(typingMention) !== -1) {
            mentions.splice(mentions.indexOf(typingMention), 1);
        }

        this.updateMentionTab(null, mentions);
        this.mentions = mentions;
    },
    checkForNewMention: function(text) {
        var caret = utils.getCaretPosition(this.refs.message.getDOMNode());

        var preText = text.substring(0, caret);

        var atIndex = preText.lastIndexOf('@');

        // The @ character not typed, so nothing to do.
        if (atIndex === -1) {
            this.updateMentionTab('-1', null);
            return;
        }

        var lastCharSpace = preText.lastIndexOf(String.fromCharCode(160));
        var lastSpace = preText.lastIndexOf(' ');

        // If there is a space after the last @, nothing to do.
        if (lastSpace > atIndex || lastCharSpace > atIndex) {
            this.updateMentionTab('-1', null);
            return;
        }

        // Get the name typed so far.
        var name = preText.substring(atIndex+1, preText.length).toLowerCase();
        this.updateMentionTab(name, null);
    },
    addMention: function(name) {
        var caret = utils.getCaretPosition(this.refs.message.getDOMNode());

        var text = this.props.messageText;

        var preText = text.substring(0, caret);

        var atIndex = preText.lastIndexOf('@');

        // The @ character not typed, so nothing to do.
        if (atIndex === -1) {
            return;
        }

        var prefix = text.substring(0, atIndex);
        var suffix = text.substring(caret, text.length);
        this.caret = prefix.length + name.length + 2;
        this.addedMention = true;
        this.doProcessMentions = true;

        this.props.onUserInput(prefix + "@" + name + " " + suffix);
    },
    addCommand: function(cmd) {
        var elm = this.refs.message.getDOMNode();
        elm.value = cmd;
        this.handleChange();
    },
    scroll: function() {
        var e = this.refs.message.getDOMNode();
        var d = this.refs.textdiv.getDOMNode();
        $(d).scrollTop($(e).scrollTop());
    },
    resize: function() {
        var e = this.refs.message.getDOMNode();
        var w = this.refs.wrapper.getDOMNode();
        var d = this.refs.textdiv.getDOMNode();

        var lht = parseInt($(e).css('lineHeight'),10);
        var lines = e.scrollHeight / lht;
        var mod = lines < 2.5 || this.props.messageText === "" ? 30 : 15;

        if (e.scrollHeight - mod < 167) {
            $(e).css({'height':'auto','overflow-y':'hidden'}).height(e.scrollHeight - mod);
            $(d).css({'height':'auto','overflow-y':'hidden'}).height(e.scrollHeight - mod);
            $(w).css({'height':'auto'}).height(e.scrollHeight+2);
        } else {
            $(e).css({'height':'auto','overflow-y':'scroll'}).height(167);
            $(d).css({'height':'auto','overflow-y':'scroll'}).height(167);
            $(w).css({'height':'auto'}).height(167);
        }

        $(d).scrollTop($(e).scrollTop());
    },
    handleFocus: function() {
        var elm = this.refs.message.getDOMNode();
        if (elm.title === elm.value) {
            elm.value = "";
        }
    },
    handleBlur: function() {
        var elm = this.refs.message.getDOMNode();
        if (elm.value === '') {
            elm.value = elm.title;
        }
    },
    handlePaste: function() {
        this.doProcessMentions = true;
    },
    render: function() {
        return (
            <div ref="wrapper" className="textarea-wrapper">
                <CommandList ref='commands' addCommand={this.addCommand} channelId={this.props.channelId} />
                <div className="form-control textarea-div" ref="textdiv"/>
                <textarea id={this.props.id} ref="message" className="form-control custom-textarea" spellCheck="true" autoComplete="off" autoCorrect="off" rows="1" placeholder={this.props.createMessage} value={this.props.messageText} onInput={this.handleChange} onChange={this.handleChange} onKeyPress={this.handleKeyPress} onKeyDown={this.handleKeyDown} onScroll={this.scroll} onFocus={this.handleFocus} onBlur={this.handleBlur} onPaste={this.handlePaste} />
            </div>
        );
    }
});
