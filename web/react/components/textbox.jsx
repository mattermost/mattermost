// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
const PostStore = require('../stores/post_store.jsx');
const CommandList = require('./command_list.jsx');
const ErrorStore = require('../stores/error_store.jsx');

const Utils = require('../utils/utils.jsx');
const Constants = require('../utils/constants.jsx');
const ActionTypes = Constants.ActionTypes;

export default class Textbox extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onListenerChange = this.onListenerChange.bind(this);
        this.onRecievedError = this.onRecievedError.bind(this);
        this.updateMentionTab = this.updateMentionTab.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBackspace = this.handleBackspace.bind(this);
        this.checkForNewMention = this.checkForNewMention.bind(this);
        this.addMention = this.addMention.bind(this);
        this.addCommand = this.addCommand.bind(this);
        this.resize = this.resize.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handlePaste = this.handlePaste.bind(this);

        this.state = {
            mentionText: '-1',
            mentions: [],
            connection: ''
        };

        this.caret = -1;
        this.addedMention = false;
        this.doProcessMentions = false;
        this.mentions = [];
    }

    getStateFromStores() {
        const error = ErrorStore.getLastError();

        if (error) {
            return {message: error.message};
        }

        return {message: null};
    }

    componentDidMount() {
        PostStore.addAddMentionListener(this.onListenerChange);
        ErrorStore.addChangeListener(this.onRecievedError);

        this.resize();
        this.updateMentionTab(null);
    }

    componentWillUnmount() {
        PostStore.removeAddMentionListener(this.onListenerChange);
        ErrorStore.removeChangeListener(this.onRecievedError);
    }

    onListenerChange(id, username) {
        if (id === this.props.id) {
            this.addMention(username);
        }
    }

    onRecievedError() {
        const errorState = ErrorStore.getLastError();

        if (errorState && errorState.connErrorCount > 0) {
            this.setState({connection: 'bad-connection'});
        } else {
            this.setState({connection: ''});
        }
    }

    componentDidUpdate() {
        if (this.caret >= 0) {
            Utils.setCaretPosition(React.findDOMNode(this.refs.message), this.caret);
            this.caret = -1;
        }
        if (this.doProcessMentions) {
            this.updateMentionTab(null);
            this.doProcessMentions = false;
        }
        this.resize();
    }

    componentWillReceiveProps(nextProps) {
        if (!this.addedMention) {
            this.checkForNewMention(nextProps.messageText);
        }
        const text = React.findDOMNode(this.refs.message).value;
        if (nextProps.channelId !== this.props.channelId || nextProps.messageText !== text) {
            this.doProcessMentions = true;
        }
        this.addedMention = false;
        this.refs.commands.getSuggestedCommands(nextProps.messageText);
    }

    updateMentionTab(mentionText) {
        // using setTimeout so dispatch isn't called during an in progress dispatch
        setTimeout(() => {
            AppDispatcher.handleViewAction({
                type: ActionTypes.RECIEVED_MENTION_DATA,
                id: this.props.id,
                mention_text: mentionText
            });
        }, 1);
    }

    handleChange() {
        this.props.onUserInput(React.findDOMNode(this.refs.message).value);
    }

    handleKeyPress(e) {
        const text = React.findDOMNode(this.refs.message).value;

        if (!this.refs.commands.isEmpty() && text.indexOf('/') === 0 && e.which === 13) {
            this.refs.commands.addFirstCommand();
            e.preventDefault();
            return;
        }

        if (!this.doProcessMentions) {
            const caret = Utils.getCaretPosition(React.findDOMNode(this.refs.message));
            const preText = text.substring(0, caret);
            const lastSpace = preText.lastIndexOf(' ');
            const lastAt = preText.lastIndexOf('@');

            if (caret > lastAt && lastSpace < lastAt) {
                this.doProcessMentions = true;
            }
        }

        this.props.onKeyPress(e);
    }

    handleKeyDown(e) {
        if (Utils.getSelectedText(React.findDOMNode(this.refs.message)) !== '') {
            this.doProcessMentions = true;
        }

        if (e.keyCode === 8) {
            this.handleBackspace(e);
        }
    }

    handleBackspace() {
        const text = React.findDOMNode(this.refs.message).value;
        if (text.indexOf('/') === 0) {
            this.refs.commands.getSuggestedCommands(text.substring(0, text.length - 1));
        }

        if (this.doProcessMentions) {
            return;
        }

        const caret = Utils.getCaretPosition(React.findDOMNode(this.refs.message));
        const preText = text.substring(0, caret);
        const lastSpace = preText.lastIndexOf(' ');
        const lastAt = preText.lastIndexOf('@');

        if (caret > lastAt && (lastSpace > lastAt || lastSpace === -1)) {
            this.doProcessMentions = true;
        }
    }

    checkForNewMention(text) {
        const caret = Utils.getCaretPosition(React.findDOMNode(this.refs.message));

        const preText = text.substring(0, caret);

        const atIndex = preText.lastIndexOf('@');

        // The @ character not typed, so nothing to do.
        if (atIndex === -1) {
            this.updateMentionTab('-1');
            return;
        }

        const lastCharSpace = preText.lastIndexOf(String.fromCharCode(160));
        const lastSpace = preText.lastIndexOf(' ');

        // If there is a space after the last @, nothing to do.
        if (lastSpace > atIndex || lastCharSpace > atIndex) {
            this.updateMentionTab('-1');
            return;
        }

        // Get the name typed so far.
        const name = preText.substring(atIndex + 1, preText.length).toLowerCase();
        this.updateMentionTab(name);
    }

    addMention(name) {
        const caret = Utils.getCaretPosition(React.findDOMNode(this.refs.message));

        const text = this.props.messageText;

        const preText = text.substring(0, caret);

        const atIndex = preText.lastIndexOf('@');

        // The @ character not typed, so nothing to do.
        if (atIndex === -1) {
            return;
        }

        const prefix = text.substring(0, atIndex);
        const suffix = text.substring(caret, text.length);
        this.caret = prefix.length + name.length + 2;
        this.addedMention = true;
        this.doProcessMentions = true;

        this.props.onUserInput(`${prefix}@${name} ${suffix}`);
    }

    addCommand(cmd) {
        const elm = React.findDOMNode(this.refs.message);
        elm.value = cmd;
        this.handleChange();
    }

    resize() {
        const e = React.findDOMNode(this.refs.message);
        const w = React.findDOMNode(this.refs.wrapper);

        const prevHeight = $(e).height();

        const lht = parseInt($(e).css('lineHeight'), 10);
        const lines = e.scrollHeight / lht;
        let mod = 15;

        if (lines < 2.5 || this.props.messageText === '') {
            mod = 30;
        }

        if (e.scrollHeight - mod < 167) {
            $(e).css({height: 'auto', 'overflow-y': 'hidden'}).height(e.scrollHeight - mod);
            $(w).css({height: 'auto'}).height(e.scrollHeight + 2);
        } else {
            $(e).css({height: 'auto', 'overflow-y': 'scroll'}).height(167);
            $(w).css({height: 'auto'}).height(167);
        }

        if (prevHeight !== $(e).height() && this.props.onHeightChange) {
            this.props.onHeightChange();
        }
    }

    handleFocus() {
        const elm = React.findDOMNode(this.refs.message);
        if (elm.title === elm.value) {
            elm.value = '';
        }
    }

    handleBlur() {
        const elm = React.findDOMNode(this.refs.message);
        if (elm.value === '') {
            elm.value = elm.title;
        }
    }

    handlePaste() {
        this.doProcessMentions = true;
    }

    render() {
        return (
            <div
                ref='wrapper'
                className='textarea-wrapper'
            >
                <CommandList
                    ref='commands'
                    addCommand={this.addCommand}
                    channelId={this.props.channelId}
                />
                <textarea
                    id={this.props.id}
                    ref='message'
                    className={`form-control custom-textarea ${this.state.connection}`}
                    spellCheck='true'
                    autoComplete='off'
                    autoCorrect='off'
                    rows='1'
                    maxLength={Constants.MAX_POST_LEN}
                    placeholder={this.props.createMessage}
                    value={this.props.messageText}
                    onInput={this.handleChange}
                    onChange={this.handleChange}
                    onKeyPress={this.handleKeyPress}
                    onKeyDown={this.handleKeyDown}
                    onFocus={this.handleFocus}
                    onBlur={this.handleBlur}
                    onPaste={this.handlePaste}
                />
            </div>
        );
    }
}

Textbox.propTypes = {
    id: React.PropTypes.string.isRequired,
    channelId: React.PropTypes.string,
    messageText: React.PropTypes.string.isRequired,
    onUserInput: React.PropTypes.func.isRequired,
    onKeyPress: React.PropTypes.func.isRequired,
    onHeightChange: React.PropTypes.func,
    createMessage: React.PropTypes.string.isRequired
};
