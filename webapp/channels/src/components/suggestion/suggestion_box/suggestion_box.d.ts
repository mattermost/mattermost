// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import type Provider from 'components/suggestion/provider';

export type SuggestionBoxElement = HTMLInputElement | HTMLTextAreaElement;

/* eslint-disable react/no-unused-prop-types */

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
    providers: Provider[];

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
    onComposition?: () => void;

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
    onSuggestionsReceived?: (results: any) => void;

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
    maxLength?: string;
    delayInputUpdate?: boolean;
    spellCheck?: string;
    onMouseUp?: (e: React.MouseEvent<SuggestionBoxElement>) => void;
    onKeyUp?: (e: React.KeyboardEvent<SuggestionBoxElement>) => void;
    onHeightChange?: (height: number, maxHeight: number) => void;
    onWidthChange?: (width: number) => void;
    onPaste?: (e: ClipboardEvent) => void;
    style?: React.CSSProperties;
    tabIndex?: string;
    type?: string;
    clearable?: boolean;
    onClear?: () => void;
};

/* eslint-enable react/no-unused-prop-types */

export default class SuggestionBox extends React.PureComponent<SuggestionBoxProps> {
    getTextbox(): SuggestionBoxElement | null;
    focus(): void;
    blur(): void;
    handleEmitClearSuggestions(delay?: number): void;
    handlePretextChanged(pretext: string): void;
    static findOverlap(a: string, b: string): string;
}
