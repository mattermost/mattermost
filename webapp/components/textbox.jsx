// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
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

import React from 'react';

export default class Textbox extends React.Component {
    constructor(props) {
        super(props);

        this.focus = this.focus.bind(this);
        this.recalculateSize = this.recalculateSize.bind(this);
        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.onRecievedError = this.onRecievedError.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleHeightChange = this.handleHeightChange.bind(this);
        this.showPreview = this.showPreview.bind(this);

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

    getStateFromStores() {
        const error = ErrorStore.getLastError();

        if (error) {
            return {message: error.message};
        }

        return {message: null};
    }

    componentDidMount() {
        ErrorStore.addChangeListener(this.onRecievedError);
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

    handleKeyPress(e) {
        this.props.onKeyPress(e);
    }

    handleKeyDown(e) {
        if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
    }

    handleBlur(e) {
        if (this.props.onBlur) {
            this.props.onBlur(e);
        }
    }

    handleHeightChange(height, maxHeight) {
        const wrapper = $(this.refs.wrapper);

        // Move over attachment icon to compensate for the scrollbar
        if (height > maxHeight) {
            wrapper.closest('.post-body__cell').addClass('scroll');
        } else {
            wrapper.closest('.post-body__cell').removeClass('scroll');
        }
    }

    focus() {
        const textbox = this.refs.message.getTextbox();

        textbox.focus();
        Utils.placeCaretAtEnd(textbox);
    }

    recalculateSize() {
        this.refs.message.recalculateSize();
    }

    showPreview(e) {
        e.preventDefault();
        e.target.blur();
        this.setState({preview: !this.state.preview});
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
        let previewLink = null;
        if (Utils.isFeatureEnabled(PreReleaseFeatures.MARKDOWN_PREVIEW)) {
            previewLink = (
                <div className='md-preview__text'>
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
                </div>
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
                    maxLength={Constants.MAX_POST_LEN}
                    placeholder={this.props.createMessage}
                    onChange={this.props.onChange}
                    onKeyPress={this.handleKeyPress}
                    onKeyDown={this.handleKeyDown}
                    onBlur={this.handleBlur}
                    onHeightChange={this.handleHeightChange}
                    style={{visibility: this.state.preview ? 'hidden' : 'visible'}}
                    listComponent={SuggestionList}
                    providers={this.suggestionProviders}
                    channelId={this.props.channelId}
                    value={this.props.value}
                    renderDividers={true}
                />
                <div
                    ref='preview'
                    className='form-control custom-textarea textbox-preview-area'
                    style={{display: this.state.preview ? 'block' : 'none'}}
                    dangerouslySetInnerHTML={{__html: this.state.preview ? TextFormatting.formatText(this.props.value) : ''}}
                />
                {previewLink}
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
    value: React.PropTypes.string.isRequired,
    onChange: React.PropTypes.func.isRequired,
    onKeyPress: React.PropTypes.func.isRequired,
    createMessage: React.PropTypes.string.isRequired,
    onKeyDown: React.PropTypes.func,
    onBlur: React.PropTypes.func,
    supportsCommands: React.PropTypes.bool.isRequired
};
