// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AtMentionProvider from './suggestion/at_mention_provider.jsx';
import CommandProvider from './suggestion/command_provider.jsx';
import EmoticonProvider from './suggestion/emoticon_provider.jsx';
import SuggestionList from './suggestion/suggestion_list.jsx';
import SuggestionBox from './suggestion/suggestion_box.jsx';
import ErrorStore from '../stores/error_store.jsx';

import * as TextFormatting from '../utils/text_formatting.jsx';
import * as Utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';

import {FormattedMessage} from 'mm-intl';

const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

export default class Textbox extends React.Component {
    constructor(props) {
        super(props);

        this.focus = this.focus.bind(this);
        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onRecievedError = this.onRecievedError.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.resize = this.resize.bind(this);
        this.showPreview = this.showPreview.bind(this);

        this.state = {
            connection: ''
        };

        this.suggestionProviders = [new AtMentionProvider(), new EmoticonProvider()];
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
        const errorCount = ErrorStore.getConnectionErrorCount();

        if (errorCount > 1) {
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

    focus() {
        this.refs.message.getTextbox().focus();
    }

    resize() {
        const textbox = this.refs.message.getTextbox();
        const $textbox = $(textbox);
        const $wrapper = $(ReactDOM.findDOMNode(this.refs.wrapper));

        const padding = parseInt($textbox.css('padding-bottom'), 10) + parseInt($textbox.css('padding-top'), 10);
        const borders = parseInt($textbox.css('border-bottom-width'), 10) + parseInt($textbox.css('border-top-width'), 10);
        const maxHeight = parseInt($textbox.css('max-height'), 10) - borders;

        // set the height to auto and remove the scrollbar so we can get the actual size of the contents
        $textbox.css('height', 'auto').css('overflow-y', 'hidden');

        let height = textbox.scrollHeight - padding;

        if (height + padding > maxHeight) {
            height = maxHeight - padding;

            // turn scrollbar on and move over attachment icon to compensate for that
            $textbox.css('overflow-y', 'scroll');
            $wrapper.closest('.post-body__cell').addClass('scroll');
        } else {
            $wrapper.closest('.post-body__cell').removeClass('scroll');
        }

        // set the textarea to be the proper height
        $textbox.height(height);

        // set the wrapper height to match the height of the textbox including padding and borders
        $wrapper.height(height + padding + borders);

        if (this.state.preview) {
            $(ReactDOM.findDOMNode(this.refs.preview)).height(height + borders);
        }
    }

    showPreview(e) {
        e.preventDefault();
        e.target.blur();
        this.setState({preview: !this.state.preview});
        this.resize();
    }

    render() {
        const hasText = this.props.messageText.length > 0;

        let previewLink = null;
        if (Utils.isFeatureEnabled(PreReleaseFeatures.MARKDOWN_PREVIEW)) {
            previewLink = (
                <a
                    onClick={this.showPreview}
                    className='textbox-preview-link'
                >
                    {this.state.preview ? (
                        <FormattedMessage
                            id='textbox.edit'
                            defaultMessage='Edit message'
                        />
                    ) : (
                        <FormattedMessage
                            id='textbox.preview'
                            defaultMessage='Preview'
                        />
                    )}
                </a>
            );
        }

        let helpText = (
            <div
                style={{visibility: hasText ? 'visible' : 'hidden', opacity: hasText ? '0.5' : '0'}}
                className='help_format_text'
            >
                <b>
                    <FormattedMessage
                        id='textbox.bold'
                        defaultMessage='**bold**'
                    />
                </b>
                <i>
                    <FormattedMessage
                        id='textbox.italic'
                        defaultMessage='_italic_'
                    />
                </i>
                <span>~~<strike>
                    <FormattedMessage
                        id='textbox.strike'
                        defaultMessage='strike'
                    />
                </strike>~~ </span>
                <code>
                    <FormattedMessage
                        id='textbox.inlinecode'
                        defaultMessage='`inline code`'
                    />
                </code>
                <code>
                    <FormattedMessage
                        id='textbox.preformatted'
                        defaultMessage='```preformatted```'
                    />
                </code>
                <span>
                    <FormattedMessage
                        id='textbox.quote'
                        defaultMessage='>quote'
                    />
                </span>
            </div>
        );

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
                {helpText}
                <div className='help__text'>
                    {previewLink}
                    <a
                        target='_blank'
                        href='http://docs.mattermost.com/help/getting-started/messaging-basics.html'
                        className='textbox-help-link'
                    >
                        <FormattedMessage
                            id='textbox.help'
                            defaultMessage='Help'
                        />
                    </a>
                </div>
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
    createMessage: React.PropTypes.string.isRequired,
    onKeyDown: React.PropTypes.func,
    supportsCommands: React.PropTypes.bool.isRequired
};
