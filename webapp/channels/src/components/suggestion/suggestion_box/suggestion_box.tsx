// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import QuickInput from 'components/quick_input';
import type Provider from 'components/suggestion/provider';
import type {ProviderResult, ResultsCallback} from 'components/suggestion/provider';
import SuggestionDate from 'components/suggestion/suggestion_date';

import Constants, {A11yCustomEventTypes} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';

const EXECUTE_CURRENT_COMMAND_ITEM_ID = Constants.Integrations.EXECUTE_CURRENT_COMMAND_ITEM_ID;
const OPEN_COMMAND_IN_MODAL_ITEM_ID = Constants.Integrations.OPEN_COMMAND_IN_MODAL_ITEM_ID;
const KeyCodes = Constants.KeyCodes;

type Props = {

    /**
     * The list component to render, usually SuggestionList
     */
    listComponent?: any;

    /**
     * Where the list will be displayed relative to the input box, defaults to 'top'
     */
    listPosition?: 'top' | 'bottom';

    /**
     * The input component to render (it is passed through props to the QuickInput)
     */
    inputComponent?: any;

    /**
     * The value of in the input
     */
    value: string;

    /**
     * Array of suggestion providers
     */
    providers: Provider[];

    /**
     * CSS class for the div parent of the input box
     */
    containerClass?: string;

    /**
     * Set to ['all'] to draw all available dividers, or use an array of the types of dividers to only render those
     * (e.g. [Constants.MENTION_RECENT_CHANNELS, Constants.MENTION_PUBLIC_CHANNELS]) between types of list items
     */
    renderDividers?: string[];

    /**
     * Set to true to render a message when there were no results found, defaults to false
     */
    renderNoResults?: boolean;

    /**
     * Set to true if we want the suggestions to take in the complete word as the pretext, defaults to false
     */
    shouldSearchCompleteText?: boolean;

    /**
     * Set to allow TAB to select an item in the list, defaults to true
     */
    completeOnTab?: boolean;

    onComposition?: () => void;

    /**
     * Function called when an item is selected
     */
    onItemSelected?: () => void;

    /**
     * The number of characters required to show the suggestion list, defaults to 1
     */
    requiredCharacters?: number;

    /**
     * If true, the suggestion box is opened on focus, default to false
     */
    openOnFocus?: boolean;

    /**
     * If true, the suggestion box is disabled
     */
    disabled?: boolean;

    /**
     * If true, it displays allow to display a default list when empty
     */
    openWhenEmpty?: boolean;

    /**
     * If true, replace all input in the suggestion box with the selected option after a select, defaults to false
     */
    replaceAllInputOnSelect?: boolean;

    /**
     * Allows parent to access received suggestions
     */
    onSuggestionsReceived?: (suggestions: ProviderResult<unknown>) => void;

    /**
     * To show suggestions even when focus is lost
     */
    forceSuggestionsWhenBlur?: boolean;

    /**
     * aligns the suggestionlist with the textbox dimension
     */
    alignWithTextbox?: boolean;

    actions: {
        addMessageIntoHistory: () => void;
    };

    // Props passed onto the input
    className?: string;
    maxLength?: number;
    id?: string;
    onBlur?: React.FocusEventHandler<InputElement>;
    onChange?: React.ChangeEventHandler<InputElement>;
    onFocus?: React.FocusEventHandler<InputElement>;
    onKeyDown?: React.KeyboardEventHandler<InputElement>;
    onKeyPress?: React.KeyboardEventHandler<InputElement>;
    onKeyUp?: React.KeyboardEventHandler<InputElement>;
    onMouseUp?: React.MouseEventHandler<InputElement>;
    onPaste?: React.ClipboardEventHandler<InputElement>;
    placeholder?: string;
    spellCheck?: string;
    style?: React.CSSProperties;
    tabIndex?: number;
    type?: string;

    // Props from QuickInput
    delayInputUpdate?: boolean;
    clearable?: boolean;
    onClear?: () => void;

    // Props from AutosizeTextarea
    onHeightChange?: () => void;
    onWidthChange?: () => void;

};

type State = {
    focused: boolean;
    cleared: boolean;
    matchedPretext: string[];
    items: unknown[];
    terms: string[];
    components: any[];
    selection: string;
    selectionIndex: number;
    allowDividers: boolean;
    presentationType: string;
    suggestionBoxAlgn: ReturnType<typeof Utils.getSuggestionBoxAlgn> | undefined;
}

export default class SuggestionBox extends React.PureComponent<Props, State> {
    static defaultProps = {
        listPosition: 'top',
        containerClass: '',
        renderDividers: [],
        renderNoResults: false,
        shouldSearchCompleteText: false,
        completeOnTab: true,
        requiredCharacters: 1,
        openOnFocus: false,
        openWhenEmpty: false,
        replaceAllInputOnSelect: false,
        forceSuggestionsWhenBlur: false,
        alignWithTextbox: false,
    };

    private container?: HTMLDivElement;
    private inputRef = React.createRef<InputElement>();
    private suggestionReadOut = React.createRef<HTMLDivElement>();

    /**
     * Keep track of whether we're composing a CJK character so we can make suggestions for partial characters
     */
    private composing = false;

    private pretext = '';

    /**
     * Used for debouncing pretext changes
     */
    private timeoutId = 0;

    /**
     * Used for preventing suggestion list to close when scrollbar is clicked
     */
    private preventSuggestionListCloseFlag = false;

    constructor(props: Props) {
        super(props);

        // pretext: the text before the cursor
        // matchedPretext: a list of the text before the cursor that will be replaced if the corresponding autocomplete term is selected
        // terms: a list of strings which the previously typed text may be replaced by
        // items: a list of objects backing the terms which may be used in rendering
        // components: a list of react components that can be used to render their corresponding item
        // selection: the term currently selected by the keyboard
        this.state = {
            focused: false,
            cleared: true,
            matchedPretext: [],
            items: [],
            terms: [],
            components: [],
            selection: '',
            selectionIndex: 0,
            allowDividers: true,
            presentationType: 'text',
            suggestionBoxAlgn: undefined,
        };
    }

    componentDidMount() {
        this.handlePretextChanged(this.pretext);
    }

    componentDidUpdate() {
        const {value} = this.props;

        // Post was just submitted, update pretext property.
        if (value === '' && this.pretext !== value) {
            this.handlePretextChanged(value);
        }
    }

    getTextbox = () => {
        if (!this.inputRef.current) {
            return null;
        }

        return this.inputRef.current;
    };

    private handleEmitClearSuggestions = () => {
        this.clear();
        this.handlePretextChanged('');
    };

    private preventSuggestionListClose = () => {
        this.preventSuggestionListCloseFlag = true;
    };

    private handleFocusOut: React.FocusEventHandler = (e) => {
        if (this.preventSuggestionListCloseFlag) {
            this.preventSuggestionListCloseFlag = false;
            return;
        }

        // Focus is switching TO e.relatedTarget, so only treat this as a blur event if we're not switching
        // between children (like from the textbox to the suggestion list)
        if (this.container.contains(e.relatedTarget)) {
            return;
        }

        if (!this.props.forceSuggestionsWhenBlur) {
            this.handleEmitClearSuggestions();
        }

        this.setState({focused: false});

        if (this.props.onBlur) {
            this.props.onBlur();
        }
    };

    private handleFocusIn = (e: React.FocusEvent<HTMLDivElement>) => {
        // Focus is switching FROM e.relatedTarget, so only treat this as a focus event if we're not switching
        // between children (like from the textbox to the suggestion list). PreventSuggestionListCloseFlag is
        // checked because if true, it means that the focusIn comes from a click in the suggestion box, an
        // option choice, so we don't want the focus event to be triggered
        if (this.container.contains(e.relatedTarget) || this.preventSuggestionListCloseFlag) {
            return;
        }

        this.setState({focused: true});

        if (this.props.openOnFocus || this.props.openWhenEmpty) {
            setTimeout(() => {
                const textbox = this.getTextbox();
                if (textbox) {
                    const pretext = textbox.value.substring(0, textbox.selectionEnd!);
                    if (this.props.openWhenEmpty || pretext.length >= this.props.requiredCharacters) {
                        if (this.pretext !== pretext) {
                            this.handlePretextChanged(pretext);
                        }
                    }
                }
            });
        }

        if (this.props.onFocus) {
            this.props.onFocus();
        }
    };

    private handleChange: React.FormEventHandler = (e) => {
        const textbox = this.getTextbox();
        const pretext = this.props.shouldSearchCompleteText ? textbox.value.trim() : textbox.value.substring(0, textbox.selectionEnd);

        if (!this.composing && this.pretext !== pretext) {
            this.handlePretextChanged(pretext);
        }

        if (this.props.onChange) {
            // For historical reasons (https://github.com/mattermost/mattermost/pull/4315), SuggestionBox's onChange is a
            // FormEventHandler instead of a ChangeEventHandler.
            this.props.onChange(e as React.ChangeEvent<InputElement>);
        }
    };

    private handleCompositionStart: React.CompositionEventHandler = () => {
        this.composing = true;
        if (this.props.onComposition) {
            this.props.onComposition();
        }
    };

    private handleCompositionUpdate: React.CompositionEventHandler = (e) => {
        if (!e.data) {
            return;
        }

        // The caret appears before the CJK character currently being composed, so re-add it to the pretext
        const textbox = this.getTextbox();
        const pretext = textbox.value.substring(0, textbox.selectionStart) + e.data;

        this.handlePretextChanged(pretext);
        if (this.props.onComposition) {
            this.props.onComposition();
        }
    };

    private handleCompositionEnd: React.CompositionEventHandler = () => {
        this.composing = false;
        if (this.props.onComposition) {
            this.props.onComposition();
        }
    };

    private addTextAtCaret = (term: string, matchedPretext: string) => {
        const textbox = this.getTextbox();
        const caret = textbox.selectionEnd!;
        const text = this.props.value;
        const pretext = textbox.value.substring(0, textbox.selectionEnd);

        let prefix;
        let keepPretext = false;
        if (pretext.toLowerCase().endsWith(matchedPretext.toLowerCase())) {
            prefix = pretext.substring(0, pretext.length - matchedPretext.length);
        } else {
            // the pretext has changed since we got a term to complete so see if the term still fits the pretext
            const termWithoutMatched = term.substring(matchedPretext.length);
            const overlap = SuggestionBox.findOverlap(pretext, termWithoutMatched);

            keepPretext = overlap.length === 0;
            prefix = pretext.substring(0, pretext.length - overlap.length - matchedPretext.length);
        }

        const suffix = text.substring(caret);

        let newValue;
        if (keepPretext) {
            newValue = pretext;
        } else {
            newValue = prefix + term + ' ' + suffix;
        }

        textbox.value = newValue;

        if (this.props.onChange) {
            // fake an input event to send back to parent components
            const e = {
                target: textbox,
            };

            // don't call handleChange or we'll get into an event loop
            this.props.onChange(e);
        }

        // set the caret position after the next rendering
        window.requestAnimationFrame(() => {
            if (textbox.value === newValue) {
                Utils.setCaretPosition(textbox, prefix.length + term.length + 1);
            }
        });
    };

    private replaceText = (term: string) => {
        const textbox = this.getTextbox();
        textbox.value = term;

        if (this.props.onChange) {
            // fake an input event to send back to parent components
            const e = {
                target: textbox,
            };

            // don't call handleChange or we'll get into an event loop
            this.props.onChange(e);
        }
    };

    private handleCompleteWord = (term: string, matchedPretext: string, e?: React.SyntheticEvent) => {
        let fixedTerm = term;
        let finish = false;
        let openCommandInModal = false;
        if (term.endsWith(EXECUTE_CURRENT_COMMAND_ITEM_ID)) {
            fixedTerm = term.substring(0, term.length - EXECUTE_CURRENT_COMMAND_ITEM_ID.length);
            finish = true;
        }

        if (term.endsWith(OPEN_COMMAND_IN_MODAL_ITEM_ID)) {
            fixedTerm = term.substring(0, term.length - OPEN_COMMAND_IN_MODAL_ITEM_ID.length);
            finish = true;
            openCommandInModal = true;
        }

        if (!finish) {
            if (this.props.replaceAllInputOnSelect) {
                this.replaceText(fixedTerm);
            } else {
                this.addTextAtCaret(fixedTerm, matchedPretext);
            }
        }

        if (this.props.onItemSelected) {
            const items = this.state.items;
            const terms = this.state.terms;
            for (let i = 0; i < terms.length; i++) {
                if (terms[i] === fixedTerm) {
                    this.props.onItemSelected(items[i]);
                    break;
                }
            }
        }

        this.clear();
        this.handlePretextChanged('');

        if (openCommandInModal) {
            const appProvider = this.props.providers.find((p) => p.openAppsModalFromCommand);
            if (!appProvider) {
                return false;
            }
            appProvider.openAppsModalFromCommand(fixedTerm);
            this.props.actions.addMessageIntoHistory(fixedTerm);
            this.inputRef.current.value = '';
            this.handleChange({target: this.inputRef.current});
            return false;
        }

        this.inputRef.current.focus();

        if (finish && this.props.onKeyPress) {
            let ke = e;
            if (!e || Keyboard.isKeyPressed(e, Constants.KeyCodes.TAB)) {
                ke = new KeyboardEvent('keydown', {
                    bubbles: true, cancelable: true, keyCode: 13,
                });
                if (e) {
                    e.preventDefault();
                }
            }
            this.props.onKeyPress(ke);
            return true;
        }

        if (!finish) {
            for (const provider of this.props.providers) {
                if (provider.handleCompleteWord) {
                    provider.handleCompleteWord(fixedTerm, matchedPretext, this.handlePretextChanged);
                }
            }
        }
        return false;
    };

    private selectNext = () => {
        this.setSelectionByDelta(1);
    };

    private selectPrevious = () => {
        this.setSelectionByDelta(-1);
    };

    private setSelectionByDelta = (delta: number) => {
        let selectionIndex = this.state.terms.indexOf(this.state.selection);

        if (selectionIndex === -1) {
            this.setState({
                selection: '',
            });
            return;
        }

        selectionIndex += delta;

        if (selectionIndex < 0) {
            selectionIndex = 0;
        } else if (selectionIndex > this.state.terms.length - 1) {
            selectionIndex = this.state.terms.length - 1;
        }

        this.setState({
            selection: this.state.terms[selectionIndex],
            selectionIndex,
        });
    };

    private setSelection = (term: string) => {
        const selectionIndex = this.state.terms.indexOf(this.state.selection);

        this.setState({
            selection: term,
            selectionIndex,
        });
    };

    private clear = () => {
        if (!this.state.cleared) {
            this.setState({
                cleared: true,
                matchedPretext: [],
                terms: [],
                items: [],
                components: [],
                selection: '',
                suggestionBoxAlgn: undefined,
            });
        }
    };

    private hasSuggestions = () => {
        return this.state.items.some((item) => !item.loading);
    };

    private confirmPretext = () => {
        const textbox = this.getTextbox();
        const pretext = textbox.value.substring(0, textbox.selectionEnd).toLowerCase();

        if (this.pretext !== pretext) {
            this.handlePretextChanged(pretext);
        }
    };

    private handleKeyUp: React.KeyboardEventHandler = (e) => {
        this.confirmPretext();
        if (this.props.onKeyUp) {
            this.props.onKeyUp(e);
        }
    };

    private handleMouseUp: React.MouseEventHandler = (e) => {
        this.confirmPretext();
        if (this.props.onMouseUp) {
            this.props.onMouseUp(e);
        }
    };

    private handleKeyDown: React.KeyboardEventHandler = (e) => {
        if ((this.props.openWhenEmpty || this.props.value) && this.hasSuggestions()) {
            const ctrlOrMetaKeyPressed = e.ctrlKey || e.metaKey;
            if (Keyboard.isKeyPressed(e, KeyCodes.UP)) {
                this.selectPrevious();
                e.preventDefault();
            } else if (Keyboard.isKeyPressed(e, KeyCodes.DOWN)) {
                this.selectNext();
                e.preventDefault();
            } else if ((Keyboard.isKeyPressed(e, KeyCodes.ENTER) && !ctrlOrMetaKeyPressed) || (this.props.completeOnTab && Keyboard.isKeyPressed(e, KeyCodes.TAB))) {
                let matchedPretext = '';
                for (let i = 0; i < this.state.terms.length; i++) {
                    if (this.state.terms[i] === this.state.selection) {
                        matchedPretext = this.state.matchedPretext[i];
                    }
                }

                // If these don't match, the user typed quickly and pressed enter before we could
                // update the pretext, so update the pretext before completing
                if (this.pretext.toLowerCase().endsWith(matchedPretext.toLowerCase())) {
                    if (this.handleCompleteWord(this.state.selection, matchedPretext, e)) {
                        return;
                    }
                } else {
                    clearTimeout(this.timeoutId);
                    this.nonDebouncedPretextChanged(this.pretext, true);
                }

                if (this.props.onKeyDown) {
                    this.props.onKeyDown(e);
                }
                e.preventDefault();
            } else if (Keyboard.isKeyPressed(e, KeyCodes.ESCAPE)) {
                this.clear();
                this.setState({presentationType: 'text'});
                e.preventDefault();
            } else if (this.props.onKeyDown) {
                this.props.onKeyDown(e);
            }
        } else if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
    };

    private focusInputOnEscape = () => {
        if (this.inputRef.current) {
            document.dispatchEvent(new CustomEvent(
                A11yCustomEventTypes.FOCUS, {
                    detail: {
                        target: this.inputRef.current,
                        keyboardOnly: true,
                    },
                },
            ));
        }
    };

    private handleReceivedSuggestions = (suggestions: ProviderResult<unknown>) => {
        let newComponents = [];
        const newPretext = [];
        if (this.props.onSuggestionsReceived) {
            this.props.onSuggestionsReceived(suggestions);
        }

        for (let i = 0; i < suggestions.terms.length; i++) {
            newComponents.push(suggestions.component);
            newPretext.push(suggestions.matchedPretext);
        }

        if (suggestions.components) {
            newComponents = suggestions.components;
        }

        const terms = suggestions.terms;
        const items = suggestions.items;
        let selection = this.state.selection;
        const selectionIndex = terms.indexOf(selection);
        if (selectionIndex !== this.state.selectionIndex) {
            if (terms.length > 0) {
                selection = terms[0];
            } else if (this.state.selection) {
                selection = '';
            }
        }

        this.setState({
            cleared: false,
            selection,
            terms,
            items,
            components: newComponents,
            matchedPretext: newPretext,
        });

        return {selection, matchedPretext: suggestions.matchedPretext};
    };

    private handleReceivedSuggestionsAndComplete = (suggestions: ProviderResult<unknown>) => {
        const {selection, matchedPretext} = this.handleReceivedSuggestions(suggestions);
        if (selection) {
            this.handleCompleteWord(selection, matchedPretext);
        }
    };

    private nonDebouncedPretextChanged = (pretext: string, complete = false) => {
        const {alignWithTextbox} = this.props;
        this.pretext = pretext;
        let handled = false;
        let callback: ResultsCallback<unknown> = this.handleReceivedSuggestions;
        if (complete) {
            callback = this.handleReceivedSuggestionsAndComplete;
        }
        for (const provider of this.props.providers) {
            handled = provider.handlePretextChanged(pretext, callback) || handled;

            if (handled) {
                if (!this.state.suggestionBoxAlgn && ['@', ':', '~', '/'].includes(provider.triggerCharacter)) {
                    const char = provider.triggerCharacter;
                    const pxToSubstract = Utils.getPxToSubstract(char);

                    // get the alignment for the box and set it in the component state
                    const suggestionBoxAlgn = Utils.getSuggestionBoxAlgn(this.getTextbox(), pxToSubstract, alignWithTextbox);
                    this.setState({
                        suggestionBoxAlgn,
                    });
                }

                this.setState({
                    presentationType: provider.presentationType(),
                    allowDividers: provider.allowDividers(),
                });

                break;
            }
        }
        if (!handled) {
            this.clear();
        }
    };

    private debouncedPretextChanged = (pretext: string) => {
        clearTimeout(this.timeoutId);
        this.timeoutId = window.setTimeout(() => this.nonDebouncedPretextChanged(pretext), Constants.SEARCH_TIMEOUT_MILLISECONDS);
    };

    private handlePretextChanged = (pretext: string) => {
        this.pretext = pretext;
        this.debouncedPretextChanged(pretext);
    };

    blur = () => {
        this.inputRef.current.blur();
    };

    focus = () => {
        const input = this.inputRef.current;
        if (input.value === '""' || input.value.endsWith('""')) {
            input.selectionStart = input.value.length - 1;
            input.selectionEnd = input.value.length - 1;
        } else {
            input.selectionStart = input.value.length;
        }
        input.focus();

        this.handleChange({target: this.inputRef.current});
    };

    private setContainerRef = (container: HTMLDivElement) => {
        // Attach/detach event listeners that aren't supported by React
        if (this.container) {
            this.container.removeEventListener('focusin', this.handleFocusIn);
            this.container.removeEventListener('focusout', this.handleFocusOut);
        }

        if (container) {
            container.addEventListener('focusin', this.handleFocusIn);
            container.addEventListener('focusout', this.handleFocusOut);
        }

        // Save ref
        this.container = container;
    };

    private getListPosition = (listPosition: string | undefined) => {
        if (!this.state.suggestionBoxAlgn) {
            return listPosition;
        }

        return listPosition === 'bottom' && this.state.suggestionBoxAlgn.placementShift ? 'top' : listPosition;
    };

    render() {
        const {
            listComponent,
            listPosition,
            renderNoResults,
            ...props
        } = this.props;

        // set the renderDivider const to either the value stored in the renderDividers prop or an empty string
        // (the renderDividers prop can also probably be a empty string, but is not guaranteed to be)
        let renderDividers;
        if (this.state.allowDividers) {
            renderDividers = this.props.renderDividers;
        }

        // Don't pass props used by SuggestionBox
        Reflect.deleteProperty(props, 'providers');
        Reflect.deleteProperty(props, 'onChange'); // We use onInput instead of onChange on the actual input
        Reflect.deleteProperty(props, 'onComposition');
        Reflect.deleteProperty(props, 'onItemSelected');
        Reflect.deleteProperty(props, 'completeOnTab');
        Reflect.deleteProperty(props, 'requiredCharacters');
        Reflect.deleteProperty(props, 'openOnFocus');
        Reflect.deleteProperty(props, 'openWhenEmpty');
        Reflect.deleteProperty(props, 'onFocus');
        Reflect.deleteProperty(props, 'onBlur');
        Reflect.deleteProperty(props, 'containerClass');
        Reflect.deleteProperty(props, 'replaceAllInputOnSelect');
        Reflect.deleteProperty(props, 'renderDividers');
        Reflect.deleteProperty(props, 'forceSuggestionsWhenBlur');
        Reflect.deleteProperty(props, 'onSuggestionsReceived');
        Reflect.deleteProperty(props, 'actions');
        Reflect.deleteProperty(props, 'shouldSearchCompleteText');
        Reflect.deleteProperty(props, 'alignWithTextbox');

        // This needs to be upper case so React doesn't think it's an html tag
        const SuggestionListComponent = listComponent;

        return (
            <div
                ref={this.setContainerRef}
                className={this.props.containerClass}
            >
                <div
                    ref={this.suggestionReadOut}
                    aria-live='polite'
                    role='alert'
                    className='sr-only'
                />
                <QuickInput<InputElement>
                    inputRef={this.inputRef}
                    autoComplete='off'
                    {...props}
                    onInput={this.handleChange}
                    onCompositionStart={this.handleCompositionStart}
                    onCompositionUpdate={this.handleCompositionUpdate}
                    onCompositionEnd={this.handleCompositionEnd}
                    onKeyDown={this.handleKeyDown}
                    onKeyUp={this.handleKeyUp}
                    onMouseUp={this.handleMouseUp}
                />
                {(this.props.openWhenEmpty || this.props.value.length >= this.props.requiredCharacters) && this.state.presentationType === 'text' && (
                    <SuggestionListComponent
                        ariaLiveRef={this.suggestionReadOut}
                        open={this.state.focused || this.props.forceSuggestionsWhenBlur}
                        pretext={this.pretext}
                        position={this.getListPosition(listPosition)}
                        renderDividers={renderDividers}
                        renderNoResults={renderNoResults}
                        onCompleteWord={this.handleCompleteWord}
                        preventClose={this.preventSuggestionListClose}
                        onItemHover={this.setSelection}
                        cleared={this.state.cleared}
                        matchedPretext={this.state.matchedPretext}
                        items={this.state.items}
                        terms={this.state.terms}
                        suggestionBoxAlgn={this.state.suggestionBoxAlgn}
                        selection={this.state.selection}
                        components={this.state.components}
                        inputRef={this.inputRef}
                        onLoseVisibility={this.blur}
                    />
                )}
                {(this.props.openWhenEmpty || this.props.value.length >= this.props.requiredCharacters) && this.state.presentationType === 'date' &&
                    <SuggestionDate
                        items={this.state.items}
                        terms={this.state.terms}
                        components={this.state.components}
                        matchedPretext={this.state.matchedPretext}
                        onCompleteWord={this.handleCompleteWord}
                        preventClose={this.preventSuggestionListClose}
                        handleEscape={this.focusInputOnEscape}
                    />
                }
            </div>
        );
    }

    // Finds the longest substring that's at both the end of b and the start of a. For example,
    // if a = "firepit" and b = "pitbull", findOverlap would return "pit".
    static findOverlap(a: string, b: string) {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();

        for (let i = bLower.length; i > 0; i--) {
            const substring = bLower.substring(0, i);

            if (aLower.endsWith(substring)) {
                return substring;
            }
        }

        return '';
    }
}
