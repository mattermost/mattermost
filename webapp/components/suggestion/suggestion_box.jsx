// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';

import Constants from 'utils/constants.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import SuggestionStore from 'stores/suggestion_store.jsx';
import * as Utils from 'utils/utils.jsx';

import TextareaAutosize from 'react-textarea-autosize';

const KeyCodes = Constants.KeyCodes;

import React from 'react';

export default class SuggestionBox extends React.Component {
    constructor(props) {
        super(props);

        this.handleDocumentClick = this.handleDocumentClick.bind(this);

        this.handleCompleteWord = this.handleCompleteWord.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handlePretextChanged = this.handlePretextChanged.bind(this);

        this.suggestionId = Utils.generateId();
        SuggestionStore.registerSuggestionBox(this.suggestionId);
    }

    componentDidMount() {
        $(document).on('click touchstart', this.handleDocumentClick);

        SuggestionStore.addCompleteWordListener(this.suggestionId, this.handleCompleteWord);
        SuggestionStore.addPretextChangedListener(this.suggestionId, this.handlePretextChanged);
    }

    componentWillUnmount() {
        SuggestionStore.removeCompleteWordListener(this.suggestionId, this.handleCompleteWord);
        SuggestionStore.removePretextChangedListener(this.suggestionId, this.handlePretextChanged);

        SuggestionStore.unregisterSuggestionBox(this.suggestionId);
        $(document).off('click touchstart', this.handleDocumentClick);
    }

    getTextbox() {
        // this is to support old code that looks at the input/textarea DOM nodes
        let textbox = this.refs.textbox;

        if (!(textbox instanceof HTMLElement)) {
            textbox = ReactDOM.findDOMNode(textbox);
        }

        return textbox;
    }

    handleDocumentClick(e) {
        const container = $(ReactDOM.findDOMNode(this));
        if ($('.suggestion-list__content').length) {
            if (!($(e.target).hasClass('suggestion-list__content') || $(e.target).parents().hasClass('suggestion-list__content'))) {
                $('body').removeClass('modal-open');
            }
        }
        if (!(container.is(e.target) || container.has(e.target).length > 0)) {
            // we can't just use blur for this because it fires and hides the children before
            // their click handlers can be called
            GlobalActions.emitClearSuggestions(this.suggestionId);
        }
    }

    handleInput(e) {
        const textbox = ReactDOM.findDOMNode(this.refs.textbox);
        const caret = Utils.getCaretPosition(textbox);
        const pretext = textbox.value.substring(0, caret);

        GlobalActions.emitSuggestionPretextChanged(this.suggestionId, pretext);

        if (this.props.onInput) {
            this.props.onInput(e);
        }
    }

    handleCompleteWord(term, matchedPretext) {
        const textbox = this.refs.textbox;
        const caret = Utils.getCaretPosition(textbox);
        const text = textbox.value;
        const pretext = text.substring(0, caret);

        let prefix;
        if (pretext.endsWith(matchedPretext)) {
            prefix = pretext.substring(0, pretext.length - matchedPretext.length);
        } else {
            // the pretext has changed since we got a term to complete so see if the term still fits the pretext
            const termWithoutMatched = term.substring(matchedPretext.length);
            const overlap = SuggestionBox.findOverlap(pretext, termWithoutMatched);

            prefix = pretext.substring(0, pretext.length - overlap.length - matchedPretext.length);
        }

        const suffix = text.substring(caret);

        this.refs.textbox.value = prefix + term + ' ' + suffix;

        if (this.props.onInput) {
            // fake an input event to send back to parent components
            const e = {
                target: this.refs.textbox
            };

            // don't call handleInput or we'll get into an event loop
            this.props.onInput(e);
        }

        // set the caret position after the next rendering
        window.requestAnimationFrame(() => {
            Utils.setCaretPosition(textbox, prefix.length + term.length + 1);
        });
    }

    handleKeyDown(e) {
        if (SuggestionStore.hasSuggestions(this.suggestionId)) {
            if (e.which === KeyCodes.UP) {
                GlobalActions.emitSelectPreviousSuggestion(this.suggestionId);
                e.preventDefault();
            } else if (e.which === KeyCodes.DOWN) {
                GlobalActions.emitSelectNextSuggestion(this.suggestionId);
                e.preventDefault();
            } else if (e.which === KeyCodes.ENTER || e.which === KeyCodes.TAB) {
                GlobalActions.emitCompleteWordSuggestion(this.suggestionId);
                e.preventDefault();
            } else if (e.which === KeyCodes.ESCAPE) {
                GlobalActions.emitClearSuggestions(this.suggestionId);
                e.stopPropagation();
            } else if (this.props.onKeyDown) {
                this.props.onKeyDown(e);
            }
        } else if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
    }

    handlePretextChanged(pretext) {
        for (const provider of this.props.providers) {
            provider.handlePretextChanged(this.suggestionId, pretext);
        }
    }

    render() {
        let textbox = null;
        if (this.props.type === 'input') {
            textbox = (
                <input
                    ref='textbox'
                    type='text'
                    {...this.props}
                    onInput={this.handleInput}
                    onKeyDown={this.handleKeyDown}
                />
            );
        } else if (this.props.type === 'search') {
            textbox = (
                <input
                    ref='textbox'
                    type='search'
                    {...this.props}
                    onInput={this.handleInput}
                    onKeyDown={this.handleKeyDown}
                />
            );
        } else if (this.props.type === 'textarea') {
            textbox = (
                <TextareaAutosize
                    id={this.suggestionId}
                    ref='textbox'
                    {...this.props}
                    onInput={this.handleInput}
                    onKeyDown={this.handleKeyDown}
                />
            );
        }

        const SuggestionListComponent = this.props.listComponent;

        return (
            <div>
                {textbox}
                <SuggestionListComponent
                    suggestionId={this.suggestionId}
                    location={this.props.listStyle}
                />
            </div>
        );
    }

    // Finds the longest substring that's at both the end of b and the start of a. For example,
    // if a = "firepit" and b = "pitbull", findOverlap would return "pit".
    static findOverlap(a, b) {
        for (let i = b.length; i > 0; i--) {
            const substring = b.substring(0, i);

            if (a.endsWith(substring)) {
                return substring;
            }
        }

        return '';
    }
}

SuggestionBox.defaultProps = {
    type: 'input',
    listStyle: 'top'
};

SuggestionBox.propTypes = {
    listComponent: React.PropTypes.func.isRequired,
    type: React.PropTypes.oneOf(['input', 'textarea', 'search']).isRequired,
    value: React.PropTypes.string.isRequired,
    providers: React.PropTypes.arrayOf(React.PropTypes.object),
    listStyle: React.PropTypes.string,

    // explicitly name any input event handlers we override and need to manually call
    onInput: React.PropTypes.func,
    onKeyDown: React.PropTypes.func
};
