// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
import EventEmitter from 'events';

const ActionTypes = Constants.ActionTypes;

const COMPLETE_WORD_EVENT = 'complete_word';
const PRETEXT_CHANGED_EVENT = 'pretext_changed';
const SUGGESTIONS_CHANGED_EVENT = 'suggestions_changed';

class SuggestionStore extends EventEmitter {
    constructor() {
        super();

        this.addSuggestionsChangedListener = this.addSuggestionsChangedListener.bind(this);
        this.removeSuggestionsChangedListener = this.removeSuggestionsChangedListener.bind(this);
        this.emitSuggestionsChanged = this.emitSuggestionsChanged.bind(this);

        this.addPretextChangedListener = this.addPretextChangedListener.bind(this);
        this.removePretextChangedListener = this.removePretextChangedListener.bind(this);
        this.emitPretextChanged = this.emitPretextChanged.bind(this);

        this.addCompleteWordListener = this.addCompleteWordListener.bind(this);
        this.removeCompleteWordListener = this.removeCompleteWordListener.bind(this);
        this.emitCompleteWord = this.emitCompleteWord.bind(this);

        this.handleEventPayload = this.handleEventPayload.bind(this);
        this.dispatchToken = AppDispatcher.register(this.handleEventPayload);

        // this.suggestions stores the state of all SuggestionBoxes by mapping their unique identifier to an
        // object with the following fields:
        // pretext: the text before the cursor
        // matchedPretext: the text before the cursor that will be replaced if an autocomplete term is selected
        // terms: a list of strings which the previously typed text may be replaced by
        // items: a list of objects backing the terms which may be used in rendering
        // components: a list of react components that can be used to render their corresponding item
        // selection: the term currently selected by the keyboard
        this.suggestions = new Map();
    }

    addSuggestionsChangedListener(id, callback) {
        this.on(SUGGESTIONS_CHANGED_EVENT + id, callback);
    }
    removeSuggestionsChangedListener(id, callback) {
        this.removeListener(SUGGESTIONS_CHANGED_EVENT + id, callback);
    }
    emitSuggestionsChanged(id) {
        this.emit(SUGGESTIONS_CHANGED_EVENT + id);
    }

    addPretextChangedListener(id, callback) {
        this.on(PRETEXT_CHANGED_EVENT + id, callback);
    }
    removePretextChangedListener(id, callback) {
        this.removeListener(PRETEXT_CHANGED_EVENT + id, callback);
    }
    emitPretextChanged(id, pretext) {
        this.emit(PRETEXT_CHANGED_EVENT + id, pretext);
    }

    addCompleteWordListener(id, callback) {
        this.on(COMPLETE_WORD_EVENT + id, callback);
    }
    removeCompleteWordListener(id, callback) {
        this.removeListener(COMPLETE_WORD_EVENT + id, callback);
    }
    emitCompleteWord(id, term) {
        this.emit(COMPLETE_WORD_EVENT + id, term);
    }

    registerSuggestionBox(id) {
        this.suggestions.set(id, {
            pretext: '',
            matchedPretext: '',
            terms: [],
            items: [],
            components: [],
            selection: ''
        });
    }

    unregisterSuggestionBox(id) {
        this.suggestions.delete(id);
    }

    clearSuggestions(id) {
        const suggestion = this.suggestions.get(id);

        suggestion.matchedPretext = '';
        suggestion.terms = [];
        suggestion.items = [];
        suggestion.components = [];
        suggestion.selection = '';
    }

    hasSuggestions(id) {
        return this.suggestions.get(id).terms.length > 0;
    }

    setPretext(id, pretext) {
        const suggestion = this.suggestions.get(id);

        suggestion.pretext = pretext;
    }

    setMatchedPretext(id, matchedPretext) {
        const suggestion = this.suggestions.get(id);

        suggestion.matchedPretext = matchedPretext;
    }

    addSuggestion(id, term, item, component) {
        const suggestion = this.suggestions.get(id);

        suggestion.terms.push(term);
        suggestion.items.push(item);
        suggestion.components.push(component);
    }

    addSuggestions(id, terms, items, component) {
        const suggestion = this.suggestions.get(id);

        suggestion.terms.push(...terms);
        suggestion.items.push(...items);

        for (let i = 0; i < terms.length; i++) {
            suggestion.components.push(component);
        }
    }

    // make sure that if suggestions exist, then one of them is selected. return true if the selection changes.
    ensureSelectionExists(id) {
        const suggestion = this.suggestions.get(id);

        if (suggestion.terms.length > 0) {
            // if the current selection is no longer in the map, select the first term in the list
            if (!suggestion.selection || suggestion.terms.indexOf(suggestion.selection) === -1) {
                suggestion.selection = suggestion.terms[0];

                return true;
            }
        } else if (suggestion.selection) {
            suggestion.selection = '';

            return true;
        }

        return false;
    }

    getPretext(id) {
        return this.suggestions.get(id).pretext;
    }

    getMatchedPretext(id) {
        return this.suggestions.get(id).matchedPretext;
    }

    getItems(id) {
        return this.suggestions.get(id).items;
    }

    getTerms(id) {
        return this.suggestions.get(id).terms;
    }

    getComponents(id) {
        return this.suggestions.get(id).components;
    }

    getSelection(id) {
        return this.suggestions.get(id).selection;
    }

    selectNext(id) {
        this.setSelectionByDelta(id, 1);
    }

    selectPrevious(id) {
        this.setSelectionByDelta(id, -1);
    }

    setSelectionByDelta(id, delta) {
        const suggestion = this.suggestions.get(id);

        let selectionIndex = suggestion.terms.indexOf(suggestion.selection);

        if (selectionIndex === -1) {
            // this should never happen since selection should always be in terms
            throw new Error('selection is not in terms');
        }

        selectionIndex += delta;

        if (selectionIndex < 0) {
            selectionIndex = 0;
        } else if (selectionIndex > suggestion.terms.length - 1) {
            selectionIndex = suggestion.terms.length - 1;
        }

        suggestion.selection = suggestion.terms[selectionIndex];
    }

    handleEventPayload(payload) {
        const {type, id, ...other} = payload.action; // eslint-disable-line no-redeclare

        switch (type) {
        case ActionTypes.SUGGESTION_PRETEXT_CHANGED:
            this.clearSuggestions(id);

            this.setPretext(id, other.pretext);
            this.emitPretextChanged(id, other.pretext);

            this.ensureSelectionExists(id);
            this.emitSuggestionsChanged(id);
            break;
        case ActionTypes.SUGGESTION_RECEIVED_SUGGESTIONS:
            this.setMatchedPretext(id, other.matchedPretext);
            this.addSuggestions(id, other.terms, other.items, other.componentType);

            this.ensureSelectionExists(id);
            this.emitSuggestionsChanged(id);
            break;
        case ActionTypes.SUGGESTION_SELECT_NEXT:
            this.selectNext(id);
            this.emitSuggestionsChanged(id);
            break;
        case ActionTypes.SUGGESTION_SELECT_PREVIOUS:
            this.selectPrevious(id);
            this.emitSuggestionsChanged(id);
            break;
        case ActionTypes.SUGGESTION_COMPLETE_WORD:
            this.emitCompleteWord(id, other.term || this.getSelection(id), this.getMatchedPretext(id));

            this.setPretext(id, '');
            this.clearSuggestions(id);
            this.emitSuggestionsChanged(id);
            break;
        }
    }
}

export default new SuggestionStore();