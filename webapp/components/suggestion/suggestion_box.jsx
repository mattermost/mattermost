// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from 'utils/constants.jsx';
import * as GlobalActions from 'actions/global_actions.jsx';
import SuggestionStore from 'stores/suggestion_store.jsx';
import * as Utils from 'utils/utils.jsx';

import AutosizeTextarea from 'components/autosize_textarea.jsx';

const KeyCodes = Constants.KeyCodes;

import PropTypes from 'prop-types';

import React from 'react';

export default class SuggestionBox extends React.Component {
    static propTypes = {

        /**
         * The list component to render, usually SuggestionList
         */
        listComponent: PropTypes.func.isRequired,

        /**
         * The HTML input box type
         */
        type: PropTypes.oneOf(['input', 'textarea', 'search']).isRequired,

        /**
         * The value of in the input
         */
        value: PropTypes.string.isRequired,

        /**
         * Array of suggestion providers
         */
        providers: PropTypes.arrayOf(PropTypes.object),

        /**
         * Where the list will be displayed relative to the input box, defaults to 'top'
         */
        listStyle: PropTypes.string,

        /**
         * Set to true to draw dividers between types of list items, defaults to false
         */
        renderDividers: PropTypes.bool,

        /**
         * Set to allow TAB to select an item in the list, defaults to true
         */
        completeOnTab: PropTypes.bool,

        /**
         * Function called when input box loses focus
         */
        onBlur: PropTypes.func,

        /**
         * Function called when input box value changes
         */
        onChange: PropTypes.func,

        /**
         * Function called when a key is pressed and the input box is in focus
         */
        onKeyDown: PropTypes.func,

        /**
         * Function called when an item is selected
         */
        onItemSelected: PropTypes.func
    }

    static defaultProps = {
        type: 'input',
        listStyle: 'top',
        renderDividers: false,
        completeOnTab: true
    }

    constructor(props) {
        super(props);

        this.handleBlur = this.handleBlur.bind(this);

        this.handleCompleteWord = this.handleCompleteWord.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleCompositionStart = this.handleCompositionStart.bind(this);
        this.handleCompositionUpdate = this.handleCompositionUpdate.bind(this);
        this.handleCompositionEnd = this.handleCompositionEnd.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handlePretextChanged = this.handlePretextChanged.bind(this);
        this.blur = this.blur.bind(this);

        this.suggestionId = Utils.generateId();
        SuggestionStore.registerSuggestionBox(this.suggestionId);

        // Keep track of whether we're composing a CJK character so we can make suggestions for partial characters
        this.composing = false;
    }

    componentDidMount() {
        SuggestionStore.addPretextChangedListener(this.suggestionId, this.handlePretextChanged);
    }

    componentWillUnmount() {
        SuggestionStore.removePretextChangedListener(this.suggestionId, this.handlePretextChanged);

        SuggestionStore.unregisterSuggestionBox(this.suggestionId);
    }

    componentDidUpdate(prevProps) {
        if (this.props.providers !== prevProps.providers) {
            const textbox = this.getTextbox();
            const pretext = textbox.value.substring(0, textbox.selectionEnd);
            GlobalActions.emitSuggestionPretextChanged(this.suggestionId, pretext);
        }
    }

    getTextbox() {
        if (this.props.type === 'textarea') {
            return this.refs.textbox.getDOMNode();
        }

        return this.refs.textbox;
    }

    recalculateSize() {
        if (this.props.type === 'textarea') {
            this.refs.textbox.recalculateSize();
        }
    }

    handleBlur() {
        setTimeout(() => {
            // Delay this slightly so that we don't clear the suggestions before we run click handlers on SuggestionList
            GlobalActions.emitClearSuggestions(this.suggestionId);
        }, 200);

        if (this.props.onBlur) {
            this.props.onBlur();
        }
    }

    handleChange(e) {
        const textbox = this.getTextbox();
        const pretext = textbox.value.substring(0, textbox.selectionEnd);

        if (!this.composing && SuggestionStore.getPretext(this.suggestionId) !== pretext) {
            GlobalActions.emitSuggestionPretextChanged(this.suggestionId, pretext);
        }

        if (this.props.onChange) {
            this.props.onChange(e);
        }
    }

    handleCompositionStart() {
        this.composing = true;
    }

    handleCompositionUpdate(e) {
        if (!e.data) {
            return;
        }

        // The caret appears before the CJK character currently being composed, so re-add it to the pretext
        const textbox = this.getTextbox();
        const pretext = textbox.value.substring(0, textbox.selectionStart) + e.data;

        if (SuggestionStore.getPretext(this.suggestionId) !== pretext) {
            GlobalActions.emitSuggestionPretextChanged(this.suggestionId, pretext);
        }
    }

    handleCompositionEnd() {
        this.composing = false;
    }

    handleCompleteWord(term, matchedPretext) {
        const textbox = this.getTextbox();
        const caret = textbox.selectionEnd;
        const text = this.props.value;
        const pretext = textbox.value.substring(0, textbox.selectionEnd);

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

        if (this.props.onChange) {
            // fake an input event to send back to parent components
            const e = {
                target: this.refs.textbox
            };

            // don't call handleChange or we'll get into an event loop
            this.props.onChange(e);
        }

        if (this.props.onItemSelected) {
            const items = SuggestionStore.getItems(this.suggestionId);
            for (const i of items) {
                if (i.name === term) {
                    this.props.onItemSelected(i);
                    break;
                }
            }
        }

        textbox.focus();

        // set the caret position after the next rendering
        window.requestAnimationFrame(() => {
            Utils.setCaretPosition(textbox, prefix.length + term.length + 1);
        });

        for (const provider of this.props.providers) {
            if (provider.handleCompleteWord) {
                provider.handleCompleteWord(term, matchedPretext);
            }
        }

        GlobalActions.emitCompleteWordSuggestion(this.suggestionId);
    }

    handleKeyDown(e) {
        if (this.props.value && SuggestionStore.hasSuggestions(this.suggestionId)) {
            if (e.which === KeyCodes.UP) {
                GlobalActions.emitSelectPreviousSuggestion(this.suggestionId);
                e.preventDefault();
            } else if (e.which === KeyCodes.DOWN) {
                GlobalActions.emitSelectNextSuggestion(this.suggestionId);
                e.preventDefault();
            } else if (e.which === KeyCodes.ENTER || (this.props.completeOnTab && e.which === KeyCodes.TAB)) {
                this.handleCompleteWord(SuggestionStore.getSelection(this.suggestionId), SuggestionStore.getSelectedMatchedPretext(this.suggestionId));
                this.props.onKeyDown(e);
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
        let handled = false;
        for (const provider of this.props.providers) {
            handled = provider.handlePretextChanged(this.suggestionId, pretext) || handled;
        }

        if (!handled) {
            SuggestionStore.clearSuggestions(this.suggestionId);
        }
    }

    blur() {
        this.refs.textbox.blur();
    }

    render() {
        const {
            type,
            listComponent,
            listStyle,
            renderDividers,
            ...props
        } = this.props;

        // Don't pass props used by SuggestionBox
        Reflect.deleteProperty(props, 'providers');
        Reflect.deleteProperty(props, 'onChange'); // We use onInput instead of onChange on the actual input
        Reflect.deleteProperty(props, 'onItemSelected');
        Reflect.deleteProperty(props, 'completeOnTab');

        const childProps = {
            ref: 'textbox',
            onBlur: this.handleBlur,
            onInput: this.handleChange,
            onCompositionStart: this.handleCompositionStart,
            onCompositionUpdate: this.handleCompositionUpdate,
            onCompositionEnd: this.handleCompositionEnd,
            onKeyDown: this.handleKeyDown
        };

        let textbox = null;
        if (type === 'input') {
            textbox = (
                <input
                    type='text'
                    {...props}
                    {...childProps}
                />
            );
        } else if (type === 'search') {
            textbox = (
                <input
                    type='search'
                    {...props}
                    {...childProps}
                />
            );
        } else if (type === 'textarea') {
            textbox = (
                <AutosizeTextarea
                    {...props}
                    {...childProps}
                />
            );
        }

        // This needs to be upper case so React doesn't think it's an html tag
        const SuggestionListComponent = listComponent;

        return (
            <div ref='container'>
                {textbox}
                {this.props.value &&
                    <SuggestionListComponent
                        suggestionId={this.suggestionId}
                        location={listStyle}
                        renderDividers={renderDividers}
                        onCompleteWord={this.handleCompleteWord}
                    />
                }
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
