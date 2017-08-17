// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import AtMentionProvider from './suggestion/at_mention_provider.jsx';
import ChannelMentionProvider from './suggestion/channel_mention_provider.jsx';
import CommandProvider from './suggestion/command_provider.jsx';
import EmoticonProvider from './suggestion/emoticon_provider.jsx';
import SuggestionList from './suggestion/suggestion_list.jsx';
import SuggestionBox from './suggestion/suggestion_box.jsx';
import ErrorStore from 'stores/error_store.jsx';

import * as TextFormatting from 'utils/text_formatting.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import {FormattedMessage} from 'react-intl';

const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

import PropTypes from 'prop-types';

import React from 'react';

export default class Textbox extends React.Component {
    static propTypes = {
        id: PropTypes.string.isRequired,
        channelId: PropTypes.string,
        value: PropTypes.string.isRequired,
        onChange: PropTypes.func.isRequired,
        onKeyPress: PropTypes.func.isRequired,
        createMessage: PropTypes.string.isRequired,
        previewMessageLink: PropTypes.string,
        onKeyDown: PropTypes.func,
        onBlur: PropTypes.func,
        supportsCommands: PropTypes.bool.isRequired,
        handlePostError: PropTypes.func,
        suggestionListStyle: PropTypes.string,
        emojiEnabled: PropTypes.bool,
        isRHS: PropTypes.bool,
        popoverMentionKeyClick: React.PropTypes.bool,
        characterLimit: React.PropTypes.number
    };

    static defaultProps = {
        supportsCommands: true,
        isRHS: false,
        popoverMentionKeyClick: false,
        characterLimit: Constants.CHARACTER_LIMIT
    };

    constructor(props) {
        super(props);

        this.state = {
            connection: ''
        };

        this.suggestionProviders = [
            new AtMentionProvider(this.props.channelId),
            new ChannelMentionProvider(),
            new EmoticonProvider()
        ];
        if (props.supportsCommands) {
            this.suggestionProviders.push(new CommandProvider());
        }
    }

    componentDidMount() {
        ErrorStore.addChangeListener(this.onReceivedError);
    }

    componentWillMount() {
        this.checkMessageLength(this.props.value);
    }

    componentWillUnmount() {
        ErrorStore.removeChangeListener(this.onReceivedError);
    }

    onReceivedError = () => {
        const errorCount = ErrorStore.getConnectionErrorCount();

        if (errorCount > 1) {
            this.setState({connection: 'bad-connection'});
        } else {
            this.setState({connection: ''});
        }
    }

    handleChange = (e) => {
        this.checkMessageLength(e.target.value);
        this.props.onChange(e);
    }

    checkMessageLength = (message) => {
        if (this.props.handlePostError) {
            if (message.length > this.props.characterLimit) {
                const errorMessage = (
                    <FormattedMessage
                        id='create_post.error_message'
                        defaultMessage='Your message is too long. Character count: {length}/{limit}'
                        values={{
                            length: message.length,
                            limit: this.props.characterLimit
                        }}
                    />);
                this.props.handlePostError(errorMessage);
            } else {
                this.props.handlePostError(null);
            }
        }
    }

    handleKeyDown = (e) => {
        if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
    }

    handleBlur = (e) => {
        if (this.props.onBlur) {
            this.props.onBlur(e);
        }
    }

    handleHeightChange = (height, maxHeight) => {
        const wrapper = $(this.refs.wrapper);

        // Move over attachment icon to compensate for the scrollbar
        if (height > maxHeight) {
            wrapper.closest('.post-create').addClass('scroll');
        } else {
            wrapper.closest('.post-create').removeClass('scroll');
        }
    }

    focus = () => {
        const textbox = this.refs.message.getTextbox();

        textbox.focus();
        Utils.placeCaretAtEnd(textbox);
    }

    recalculateSize = () => {
        this.refs.message.recalculateSize();
    }

    togglePreview = (e) => {
        e.preventDefault();
        e.target.blur();
        this.setState((prevState) => {
            return {preview: !prevState.preview};
        });
    }

    hidePreview = () => {
        this.setState({preview: false});
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.channelId !== this.props.channelId) {
            // Update channel id for AtMentionProvider.
            const providers = this.suggestionProviders;
            for (let i = 0; i < providers.length; i++) {
                if (providers[i] instanceof AtMentionProvider) {
                    providers[i] = new AtMentionProvider(nextProps.channelId);
                }
            }
        }
    }

    render() {
        const hasText = this.props.value && this.props.value.length > 0;

        let editHeader;
        if (this.props.previewMessageLink) {
            editHeader = (
                <span>
                    {this.props.previewMessageLink}
                </span>
            );
        } else {
            editHeader = (
                <FormattedMessage
                    id='textbox.edit'
                    defaultMessage='Edit message'
                />
            );
        }

        let previewLink = null;
        if (Utils.isFeatureEnabled(PreReleaseFeatures.MARKDOWN_PREVIEW)) {
            previewLink = (
                <a
                    onClick={this.togglePreview}
                    className='textbox-preview-link'
                >
                    {this.state.preview ? (
                        editHeader
                    ) : (
                        <FormattedMessage
                            id='textbox.preview'
                            defaultMessage='Preview'
                        />
                    )}
                </a>
            );
        }

        const helpText = (
            <div
                style={{visibility: hasText ? 'visible' : 'hidden', opacity: hasText ? '0.45' : '0'}}
                className='help__format-text'
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
                <span>
                    {'~~'}
                    <strike>
                        <FormattedMessage
                            id='textbox.strike'
                            defaultMessage='strike'
                        />
                    </strike>
                    {'~~ '}
                </span>
                <span>
                    <FormattedMessage
                        id='textbox.inlinecode'
                        defaultMessage='`inline code`'
                    />
                </span>
                <span>
                    <FormattedMessage
                        id='textbox.preformatted'
                        defaultMessage='```preformatted```'
                    />
                </span>
                <span>
                    <FormattedMessage
                        id='textbox.quote'
                        defaultMessage='>quote'
                    />
                </span>
            </div>
        );

        let textboxClassName = 'form-control custom-textarea';
        if (this.props.emojiEnabled) {
            textboxClassName += ' custom-textarea--emoji-picker';
        }
        if (this.state.connection) {
            textboxClassName += ' ' + this.state.connection;
        }

        return (
            <div
                ref='wrapper'
                className='textarea-wrapper'
            >
                <SuggestionBox
                    id={this.props.id}
                    ref='message'
                    className={textboxClassName}
                    type='textarea'
                    spellCheck='true'
                    placeholder={this.props.createMessage}
                    onChange={this.handleChange}
                    onKeyPress={this.props.onKeyPress}
                    onKeyDown={this.handleKeyDown}
                    onBlur={this.handleBlur}
                    onHeightChange={this.handleHeightChange}
                    style={{visibility: this.state.preview ? 'hidden' : 'visible'}}
                    listComponent={SuggestionList}
                    listStyle={this.props.suggestionListStyle}
                    providers={this.suggestionProviders}
                    channelId={this.props.channelId}
                    value={this.props.value}
                    renderDividers={true}
                    isRHS={this.props.isRHS}
                    popoverMentionKeyClick={this.props.popoverMentionKeyClick}
                />
                <div
                    ref='preview'
                    className='form-control custom-textarea textbox-preview-area'
                    style={{display: this.state.preview ? 'block' : 'none'}}
                    dangerouslySetInnerHTML={{__html: this.state.preview ? TextFormatting.formatText(this.props.value) : ''}}
                />
                <div className='help__text'>
                    {helpText}
                    {previewLink}
                    <a
                        target='_blank'
                        rel='noopener noreferrer'
                        href='/help/messaging'
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
