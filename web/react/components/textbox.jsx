// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AtMentionProvider from './suggestion/at_mention_provider.jsx';
import CommandProvider from './suggestion/command_provider.jsx';
import SuggestionList from './suggestion/suggestion_list.jsx';
import SuggestionBox from './suggestion/suggestion_box.jsx';
import ErrorStore from '../stores/error_store.jsx';

import * as TextFormatting from '../utils/text_formatting.jsx';
import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';
const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

export default class Textbox extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onRecievedError = this.onRecievedError.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.resize = this.resize.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.showPreview = this.showPreview.bind(this);

        this.state = {
            connection: ''
        };

        this.suggestionProviders = [new AtMentionProvider()];
        if (props.supportsCommands) {
            this.suggestionProviders.push(new CommandProvider());
        }
    }

    getStateFromStores() {
        const error = ErrorStore.getLastError();

        if (error) {
            return {message: error.message};
        }

        return {message: null};
    }

    componentDidMount() {
        ErrorStore.addChangeListener(this.onRecievedError);

        this.resize();
    }

    componentWillUnmount() {
        ErrorStore.removeChangeListener(this.onRecievedError);
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
        this.resize();
    }

    handleKeyPress(e) {
        this.props.onKeyPress(e);
    }

    handleKeyDown(e) {
        if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
    }

    resize() {
        const e = this.refs.message.getTextbox();
        const w = ReactDOM.findDOMNode(this.refs.wrapper);

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
            $(w).closest('.post-body__cell').removeClass('scroll');
            if (this.state.preview) {
                $(ReactDOM.findDOMNode(this.refs.preview)).css({height: 'auto', 'overflow-y': 'auto'}).height(e.scrollHeight - mod);
            }
        } else {
            $(e).css({height: 'auto', 'overflow-y': 'scroll'}).height(167 - mod);
            $(w).css({height: 'auto'}).height(163);
            $(w).closest('.post-body__cell').addClass('scroll');
            if (this.state.preview) {
                $(ReactDOM.findDOMNode(this.refs.preview)).css({height: 'auto', 'overflow-y': 'scroll'}).height(163);
            }
        }

        if (prevHeight !== $(e).height() && this.props.onHeightChange) {
            this.props.onHeightChange();
        }
    }

    handleFocus() {
        const elm = this.refs.message.getTextbox();
        if (elm.title === elm.value) {
            elm.value = '';
        }
    }

    handleBlur() {
        const elm = this.refs.message.getTextbox();
        if (elm.value === '') {
            elm.value = elm.title;
        }
    }

    showPreview(e) {
        e.preventDefault();
        e.target.blur();
        this.setState({preview: !this.state.preview});
        this.resize();
    }

    showHelp(e) {
        e.preventDefault();
        e.target.blur();

        global.window.open('/docs/Messaging');
    }

    render() {
        let previewLink = null;
        if (Utils.isFeatureEnabled(PreReleaseFeatures.MARKDOWN_PREVIEW)) {
            const previewLinkVisible = this.props.messageText.length > 0;
            previewLink = (
                <a
                    style={{visibility: previewLinkVisible ? 'visible' : 'hidden'}}
                    onClick={this.showPreview}
                    className='textbox-preview-link'
                >
                    {this.state.preview ? 'Edit message' : 'Preview'}
                </a>
            );
        }

        return (
            <div
                ref='wrapper'
                className='textarea-wrapper'
            >
                <SuggestionBox
                    id={this.props.id}
                    ref='message'
                    className={`form-control custom-textarea ${this.state.connection}`}
                    type='textarea'
                    spellCheck='true'
                    autoComplete='off'
                    autoCorrect='off'
                    rows='1'
                    maxLength={Constants.MAX_POST_LEN}
                    placeholder={this.props.createMessage}
                    value={this.props.messageText}
                    onUserInput={this.props.onUserInput}
                    onKeyPress={this.handleKeyPress}
                    onKeyDown={this.handleKeyDown}
                    onFocus={this.handleFocus}
                    onBlur={this.handleBlur}
                    onPaste={this.handlePaste}
                    style={{visibility: this.state.preview ? 'hidden' : 'visible'}}
                    listComponent={SuggestionList}
                    providers={this.suggestionProviders}
                />
                <div
                    ref='preview'
                    className='form-control custom-textarea textbox-preview-area'
                    style={{display: this.state.preview ? 'block' : 'none'}}
                    dangerouslySetInnerHTML={{__html: this.state.preview ? TextFormatting.formatText(this.props.messageText) : ''}}
                >
                </div>
                {previewLink}
                <a
                    onClick={this.showHelp}
                    className='textbox-help-link'
                >
                    {'Help'}
                </a>
            </div>
        );
    }
}

Textbox.defaultProps = {
    supportsCommands: true
};

Textbox.propTypes = {
    id: React.PropTypes.string.isRequired,
    channelId: React.PropTypes.string,
    messageText: React.PropTypes.string.isRequired,
    onUserInput: React.PropTypes.func.isRequired,
    onKeyPress: React.PropTypes.func.isRequired,
    onHeightChange: React.PropTypes.func,
    createMessage: React.PropTypes.string.isRequired,
    onKeyDown: React.PropTypes.func,
    supportsCommands: React.PropTypes.bool.isRequired
};
