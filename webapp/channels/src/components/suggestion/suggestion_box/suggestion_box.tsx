// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as UserAgent from '@mattermost/shared/utils/user_agent';

import QuickInput from 'components/quick_input';

import Constants, {A11yCustomEventTypes} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import * as Utils from 'utils/utils';

import type {SuggestionProvider} from '../provider';
import type {ProviderResults, SuggestionResults} from '../suggestion_results';
import {
    emptyResults,
    flattenTerms,
    getItemForTerm,
    hasLoadedResults,
    hasResults,
    normalizeResultsFromProvider,
} from '../suggestion_results';

const EXECUTE_CURRENT_COMMAND_ITEM_ID = Constants.Integrations.EXECUTE_CURRENT_COMMAND_ITEM_ID;
const OPEN_COMMAND_IN_MODAL_ITEM_ID = Constants.Integrations.OPEN_COMMAND_IN_MODAL_ITEM_ID;
const KeyCodes = Constants.KeyCodes;

const DEFAULT_REQUIRED_CHARACTERS = 1;

export type SuggestionBoxElement = HTMLInputElement | HTMLTextAreaElement;

/** The position of the suggestion list relative to the caret, as measured by Utils.getSuggestionBoxAlgn. */
export type SuggestionBoxAlgn = {
    lineHeight?: number;
    pixelsToMoveX?: number;
    pixelsToMoveY?: number;
    placementShift?: boolean;
};

/**
 * A synthetic event used when SuggestionBox changes the input's value itself and needs to notify the parent without
 * going through a real input event.
 */
type FakeInputEvent = {
    target: SuggestionBoxElement;
};

export type SuggestionBoxProps = {

    /**
     * The list component to render, usually SuggestionList
     */
    listComponent?: React.ComponentType<any>;

    /**
     * Where the list will be displayed relative to the input box, defaults to 'top'
     */
    listPosition?: 'top' | 'bottom';

    /**
     * The input component to render (it is passed through props to the QuickInput)
     */
    inputComponent?: React.ElementType;

    /**
     * The date component to render
     */
    dateComponent?: React.ComponentType<any>;

    /**
     * The value of in the input
     */
    value: string;

    /**
     * Array of suggestion providers
     */
    providers: SuggestionProvider[];

    /**
     * CSS class for the div parent of the input box
     */
    containerClass?: string;

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

    /**
     * Function called when input box gains focus
     */
    onFocus?: () => void;

    /**
     * Function called when input box loses focus
     */
    onBlur?: (e: React.FocusEvent<SuggestionBoxElement>) => void;

    /**
     * Function called when input box value changes
     */
    onChange?: (e: React.ChangeEvent<SuggestionBoxElement>) => void;

    /**
     * Function called when a key is pressed and the input box is in focus
     */
    onKeyDown?: (e: React.KeyboardEvent<SuggestionBoxElement>) => void;
    onKeyPress?: (e: React.KeyboardEvent<SuggestionBoxElement>) => void;
    onCompositionUpdate?: () => void;

    onSearchTypeSelected?: (...args: unknown[]) => void;

    /**
     * Function called when an item is selected
     */
    onItemSelected?: (item: any) => void;

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
     * An optional, opaque identifier that distinguishes the context in which the suggestion
     * box is rendered. This allows the reused component to otherwise respond to changes.
     */
    contextId?: string;

    /**
     * Allows parent to access received suggestions
     */
    onSuggestionsReceived?: (results: SuggestionResults) => void;

    /**
     * To show suggestions even when focus is lost
     */
    forceSuggestionsWhenBlur?: boolean;

    /**
     * aligns the suggestionlist with the textbox dimension
     */
    alignWithTextbox?: boolean;

    actions: {
        addMessageIntoHistory: (message: string) => void;
    };

    /**
     * Props for input
     */
    id?: string;
    className?: string;
    placeholder?: string;
    maxLength?: number;
    delayInputUpdate?: boolean;
    spellCheck?: string;
    onMouseUp?: (e: React.MouseEvent<SuggestionBoxElement>) => void;
    onKeyUp?: (e: React.KeyboardEvent<SuggestionBoxElement>) => void;
    onHeightChange?: (height: number, maxHeight: number) => void;
    onWidthChange?: (width: number) => void;
    onPaste?: (e: ClipboardEvent) => void;
    style?: React.CSSProperties;
    tabIndex?: number;
    type?: string;
    clearable?: boolean;
    onClear?: () => void;
};

type State = {
    focused: boolean;
    cleared: boolean;
    results: SuggestionResults;
    selection: string;
    selectionIndex: number;
    allowDividers: boolean;
    presentationType: string;
    suggestionBoxAlgn?: SuggestionBoxAlgn;
};

export default class SuggestionBox extends React.PureComponent<SuggestionBoxProps, State> {
    static defaultProps = {

        // This must be narrowed rather than widened to `string`, or connect() can't reconcile the defaulted
        // props against SuggestionBoxProps and infers `never` for the connected component's props
        listPosition: 'top' as const,
        containerClass: '',
        renderNoResults: false,
        shouldSearchCompleteText: false,
        completeOnTab: true,
        requiredCharacters: DEFAULT_REQUIRED_CHARACTERS,
        openOnFocus: false,
        openWhenEmpty: false,
        replaceAllInputOnSelect: false,
        forceSuggestionsWhenBlur: false,
        alignWithTextbox: false,
    };

    /** The text before the cursor. */
    pretext = '';

    /** Used for debouncing pretext changes. */
    timeoutId?: ReturnType<typeof setTimeout>;

    /** Used for preventing suggestion list to close when scrollbar is clicked. */
    preventSuggestionListCloseFlag = false;

    inputRef = React.createRef<SuggestionBoxElement>();

    container: HTMLDivElement | null = null;

    constructor(props: SuggestionBoxProps) {
        super(props);

        this.state = {
            focused: false,
            cleared: true,
            results: emptyResults(),
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

    componentDidUpdate(prevProps: SuggestionBoxProps) {
        const {value} = this.props;

        // Post was just submitted, update pretext property.
        if (value === '' && this.pretext !== value) {
            this.handlePretextChanged(value);
            return;
        }

        if (prevProps.contextId !== this.props.contextId) {
            const textbox = this.getTextbox();
            if (!textbox) {
                return;
            }

            const pretext = textbox.value.substring(0, textbox.selectionEnd ?? 0);

            this.handlePretextChanged(pretext);
        }
    }

    componentWillUnmount() {
        clearTimeout(this.timeoutId);
    }

    private get requiredCharacters() {
        return this.props.requiredCharacters ?? DEFAULT_REQUIRED_CHARACTERS;
    }

    getTextbox = (): SuggestionBoxElement | null => {
        if (!this.inputRef.current) {
            return null;
        }

        return this.inputRef.current;
    };

    handleEmitClearSuggestions = (delay = 0) => {
        setTimeout(() => {
            this.clear();
            this.handlePretextChanged('');
        }, delay);
    };

    preventSuggestionListClose = () => {
        this.preventSuggestionListCloseFlag = true;
    };

    handleFocusOut = (e: FocusEvent) => {
        if (this.preventSuggestionListCloseFlag) {
            this.preventSuggestionListCloseFlag = false;
            return;
        }

        // Focus is switching TO e.relatedTarget, so only treat this as a blur event if we're not switching
        // between children (like from the textbox to the suggestion list)
        if (this.container?.contains(e.relatedTarget as Node | null)) {
            return;
        }

        if (UserAgent.isIos() && !e.relatedTarget) {
            // On Safari and iOS classic app, the autocomplete stays open
            // when you tap outside of the post textbox or search box.
            return;
        }

        if (!this.props.forceSuggestionsWhenBlur) {
            this.handleEmitClearSuggestions();
        }

        this.setState({focused: false});

        // This is a native event because the listener is attached to the container manually, but consumers
        // expect the React event that every other handler here receives.
        this.props.onBlur?.(e as unknown as React.FocusEvent<SuggestionBoxElement>);
    };

    handleFocusIn = (e: FocusEvent) => {
        // Focus is switching FROM e.relatedTarget, so only treat this as a focus event if we're not switching
        // between children (like from the textbox to the suggestion list). PreventSuggestionListCloseFlag is
        // checked because if true, it means that the focusIn comes from a click in the suggestion box, an
        // option choice, so we don't want the focus event to be triggered
        if (this.container?.contains(e.relatedTarget as Node | null) || this.preventSuggestionListCloseFlag) {
            return;
        }

        this.setState({focused: true});

        if (this.props.openOnFocus || this.props.openWhenEmpty) {
            setTimeout(() => {
                const textbox = this.getTextbox();
                if (textbox) {
                    const pretext = textbox.value.substring(0, textbox.selectionEnd ?? 0);
                    if (this.props.openWhenEmpty || pretext.length >= this.requiredCharacters) {
                        if (this.pretext !== pretext) {
                            this.handlePretextChanged(pretext);
                        }
                    }
                }
            });
        }

        this.props.onFocus?.();
    };

    handleChange = (e?: React.FormEvent<SuggestionBoxElement> | FakeInputEvent) => {
        const textbox = this.getTextbox();
        if (!textbox || !e) {
            return;
        }

        const pretext = this.props.shouldSearchCompleteText ? textbox.value.trim() : textbox.value.substring(0, textbox.selectionEnd ?? 0);

        if (this.pretext !== pretext) {
            this.handlePretextChanged(pretext);
        }

        this.props.onChange?.(e as React.ChangeEvent<SuggestionBoxElement>);
    };

    addTextAtCaret = (term: string, matchedPretext: string) => {
        const textbox = this.getTextbox();
        if (!textbox) {
            return;
        }

        const caret = textbox.selectionEnd ?? 0;
        const text = this.props.value;
        const pretext = textbox.value.substring(0, textbox.selectionEnd ?? 0);

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

        if (keepPretext) {
            // The term no longer fits the pretext, so don't change anything or else we might erase something
            return;
        }

        const suffix = text.substring(caret);

        const newValue = prefix + term + ' ' + suffix;
        textbox.value = newValue;

        // fake an input event to send back to parent components. Don't call handleChange or we'll get into an
        // event loop
        this.props.onChange?.({target: textbox} as unknown as React.ChangeEvent<SuggestionBoxElement>);

        // set the caret position after the next rendering
        window.requestAnimationFrame(() => {
            if (textbox.value === newValue) {
                Utils.setCaretPosition(textbox, prefix.length + term.length + 1);
            }
        });
    };

    replaceText = (term: string) => {
        const textbox = this.getTextbox();
        if (!textbox) {
            return;
        }

        textbox.value = term;

        // fake an input event to send back to parent components. Don't call handleChange or we'll get into an
        // event loop
        this.props.onChange?.({target: textbox} as unknown as React.ChangeEvent<SuggestionBoxElement>);
    };

    handleCompleteWord = (term: string, matchedPretext: string, e?: React.KeyboardEvent | KeyboardEvent) => {
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
            const item = getItemForTerm(this.state.results, fixedTerm);
            if (item) {
                this.props.onItemSelected(item);
            }
        }

        this.clear();
        this.handlePretextChanged('');

        if (openCommandInModal) {
            const appProvider = this.props.providers.find((p) => p.openAppsModalFromCommand);
            if (!appProvider?.openAppsModalFromCommand) {
                return false;
            }
            appProvider.openAppsModalFromCommand(fixedTerm);
            this.props.actions.addMessageIntoHistory(fixedTerm);

            if (this.inputRef.current) {
                this.inputRef.current.value = '';
                this.handleChange({target: this.inputRef.current});
            }
            return false;
        }

        this.inputRef.current?.focus();

        if (finish && this.props.onKeyPress) {
            let ke = e;
            if (!e || Keyboard.isKeyPressed(e, Constants.KeyCodes.TAB)) {
                ke = new KeyboardEvent('keydown', {
                    bubbles: true, cancelable: true, keyCode: 13,
                } as KeyboardEventInit);
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
            this.props.onKeyPress(ke as React.KeyboardEvent<SuggestionBoxElement>);
            return true;
        }

        if (!finish) {
            for (const provider of this.props.providers) {
                provider.handleCompleteWord?.(fixedTerm, matchedPretext, this.handlePretextChanged);
            }
        }

        e?.stopPropagation();

        return false;
    };

    selectNext = () => {
        this.setSelectionByDelta(1);
    };

    selectPrevious = () => {
        this.setSelectionByDelta(-1);
    };

    setSelectionByDelta = (delta: number) => {
        const terms = flattenTerms(this.state.results);

        let selectionIndex = terms.indexOf(this.state.selection);

        if (selectionIndex === -1) {
            this.setState({
                selection: '',
            });
            return;
        }

        selectionIndex += delta;

        if (selectionIndex < 0) {
            selectionIndex = 0;
        } else if (selectionIndex > terms.length - 1) {
            selectionIndex = terms.length - 1;
        }

        this.setState({
            selection: terms[selectionIndex],
            selectionIndex,
        });
    };

    setSelection = (term: string) => {
        const terms = flattenTerms(this.state.results);

        const selectionIndex = terms.indexOf(this.state.selection);

        this.setState({
            selection: term,
            selectionIndex,
        });
    };

    clear = () => {
        if (!this.state.cleared) {
            this.setState({
                cleared: true,
                results: emptyResults(),
                selection: '',
                suggestionBoxAlgn: undefined,
            });
        }
    };

    hasSuggestions = () => {
        return hasLoadedResults(this.state.results);
    };

    handleKeyDown = (e: React.KeyboardEvent) => {
        // QuickInput types its key handlers against a generic Element, so narrow back to the input element that
        // consumers of SuggestionBox expect
        const onKeyDown = this.props.onKeyDown as ((e: React.KeyboardEvent) => void) | undefined;

        if ((this.props.openWhenEmpty || this.props.value) && this.hasSuggestions()) {
            const ctrlOrMetaKeyPressed = e.ctrlKey || e.metaKey;
            if (Keyboard.isKeyPressed(e, KeyCodes.UP)) {
                this.selectPrevious();
                e.preventDefault();
            } else if (Keyboard.isKeyPressed(e, KeyCodes.DOWN)) {
                this.selectNext();
                e.preventDefault();
            } else if ((Keyboard.isKeyPressed(e, KeyCodes.ENTER) && !ctrlOrMetaKeyPressed) || (this.props.completeOnTab && Keyboard.isKeyPressed(e, KeyCodes.TAB))) {
                e.stopPropagation();
                const matchedPretext = this.state.results.matchedPretext;

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

                onKeyDown?.(e);
                e.preventDefault();
            } else if (Keyboard.isKeyPressed(e, KeyCodes.ESCAPE)) {
                this.clear();
                this.setState({presentationType: 'text'});
                e.preventDefault();
            } else {
                onKeyDown?.(e);
            }
        } else {
            onKeyDown?.(e);
        }
    };

    focusInputOnEscape = () => {
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

    handleReceivedSuggestions = (suggestions: ProviderResults) => {
        const results = normalizeResultsFromProvider(suggestions);

        this.props.onSuggestionsReceived?.(results);

        const terms = flattenTerms(results);
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
            results,
        });

        return {selection, matchedPretext: suggestions.matchedPretext};
    };

    makeHandleReceivedSuggestionsAndComplete = () => {
        let firstComplete = true;
        return (suggestions: ProviderResults) => {
            const {selection, matchedPretext} = this.handleReceivedSuggestions(suggestions);

            if (selection && firstComplete) {
                this.handleCompleteWord(selection, matchedPretext);
                firstComplete = false;
            }
        };
    };

    nonDebouncedPretextChanged = (pretext: string, complete = false) => {
        const {alignWithTextbox} = this.props;
        this.pretext = pretext;
        let handled = false;
        let callback: (suggestions: ProviderResults) => void = this.handleReceivedSuggestions;
        if (complete) {
            callback = this.makeHandleReceivedSuggestionsAndComplete();
        }
        for (const provider of this.props.providers) {
            handled = provider.handlePretextChanged(pretext, callback) || handled;

            if (handled) {
                if (!this.state.suggestionBoxAlgn && ['@', ':', '~', '/'].includes(provider.triggerCharacter ?? '')) {
                    const char = provider.triggerCharacter;
                    const pxToSubstract = Utils.getPxToSubstract(char);

                    // get the alignment for the box and set it in the component state
                    const suggestionBoxAlgn = Utils.getSuggestionBoxAlgn(this.getTextbox() as HTMLTextAreaElement, pxToSubstract, alignWithTextbox);
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

    debouncedPretextChanged = (pretext: string) => {
        clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => this.nonDebouncedPretextChanged(pretext), Constants.SEARCH_TIMEOUT_MILLISECONDS);
    };

    handlePretextChanged = (pretext: string) => {
        this.pretext = pretext;
        this.debouncedPretextChanged(pretext);
    };

    blur = () => {
        this.inputRef.current?.blur();
    };

    focus = () => {
        const input = this.inputRef.current;
        if (!input) {
            return;
        }

        if (input.value === '""' || input.value.endsWith('""')) {
            input.selectionStart = input.value.length - 1;
            input.selectionEnd = input.value.length - 1;
        } else {
            input.selectionStart = input.value.length;
        }
        input.focus();

        this.handleChange({target: input});
    };

    setContainerRef = (container: HTMLDivElement | null) => {
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

    getListPosition = (listPosition?: 'top' | 'bottom') => {
        if (!this.state.suggestionBoxAlgn) {
            return listPosition;
        }

        return listPosition === 'bottom' && this.state.suggestionBoxAlgn.placementShift ? 'top' : listPosition;
    };

    render() {
        const {
            dateComponent,
            listComponent,
            listPosition,
            renderNoResults,

            // Don't pass props used by SuggestionBox on to the input
            /* eslint-disable @typescript-eslint/no-unused-vars */
            providers,
            onChange, // We use onInput instead of onChange on the actual input
            onItemSelected,
            completeOnTab,
            requiredCharacters,
            openOnFocus,
            openWhenEmpty,
            onFocus,
            onBlur,
            containerClass,
            replaceAllInputOnSelect,
            contextId,
            forceSuggestionsWhenBlur,
            onSuggestionsReceived,
            actions,
            shouldSearchCompleteText,
            alignWithTextbox,
            /* eslint-enable @typescript-eslint/no-unused-vars */

            // Forwarded to the input below, but pulled out of the spread because QuickInput types its key
            // handlers against a generic Element rather than the input element consumers expect
            onKeyUp,

            ...props
        } = this.props;

        // This needs to be upper case so React doesn't think it's an html tag
        const SuggestionListComponent = listComponent;
        const SuggestionDateComponent = dateComponent;

        const showList = this.props.openWhenEmpty || this.props.value.length >= this.requiredCharacters;

        return (
            <div
                ref={this.setContainerRef}
                className={this.props.containerClass}
            >
                <QuickInput
                    ref={this.inputRef}
                    autoComplete='off'
                    {...props}
                    onKeyUp={onKeyUp as ((e: React.KeyboardEvent) => void) | undefined}
                    aria-controls='suggestionList'
                    role='combobox'
                    aria-activedescendant={this.state.selection ? `suggestionList_item_${this.state.selection}` : undefined}
                    aria-autocomplete='list'
                    aria-expanded={(this.state.focused || this.props.forceSuggestionsWhenBlur) && hasResults(this.state.results)}
                    onInput={this.handleChange}
                    onKeyDown={this.handleKeyDown}
                />
                {showList && this.state.presentationType === 'text' && SuggestionListComponent && (
                    <SuggestionListComponent
                        open={this.state.focused || this.props.forceSuggestionsWhenBlur}
                        pretext={this.pretext}
                        position={this.getListPosition(listPosition)}
                        renderNoResults={renderNoResults}
                        onCompleteWord={this.handleCompleteWord}
                        preventClose={this.preventSuggestionListClose}
                        onItemHover={this.setSelection}
                        cleared={this.state.cleared}
                        results={this.state.results}
                        suggestionBoxAlgn={this.state.suggestionBoxAlgn}
                        selection={this.state.selection}
                        inputRef={this.inputRef}
                        onLoseVisibility={this.blur}
                    />
                )}
                {showList && this.state.presentationType === 'date' && SuggestionDateComponent && (
                    <SuggestionDateComponent
                        results={this.state.results}
                        onCompleteWord={this.handleCompleteWord}
                        preventClose={this.preventSuggestionListClose}
                        handleEscape={this.focusInputOnEscape}
                    />
                )}
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
