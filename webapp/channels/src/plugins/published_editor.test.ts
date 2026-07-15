// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PublishedEditorComponentId, PublishedSuggestionProviderId} from '@mattermost/shared/types/global';

import {isPublishedEditorComponent, publishedEditorUtils, publishedSuggestionProviders} from './published_editor';

describe('publishedEditorUtils', () => {
    test('exposes the three allowlisted components', () => {
        expect(typeof publishedEditorUtils.WysiwygEditor).toBe('function');
        expect(typeof publishedEditorUtils.SuggestionList).toBe('function');
        expect(typeof publishedEditorUtils.FormattingBar).toBe('function');
    });

    test('exposes every provider constructor and each is newable', () => {
        const ids: PublishedSuggestionProviderId[] = ['AtMention', 'ChannelMention', 'Command', 'Emoticon'];

        for (const id of ids) {
            expect(typeof publishedEditorUtils.providers[id]).toBe('function');
            expect(publishedEditorUtils.providers[id]).toBe(publishedSuggestionProviders[id]);
        }
    });

    test('providers with a no-arg constructor can be instantiated directly', () => {
        const instance = new publishedEditorUtils.providers.Emoticon();
        expect(instance.triggerCharacter).toBe(':');
        expect(typeof instance.handlePretextChanged).toBe('function');
    });
});

describe('isPublishedEditorComponent', () => {
    test('is true for every published component id', () => {
        const ids: PublishedEditorComponentId[] = ['wysiwyg_editor', 'suggestion_list', 'formatting_bar'];

        for (const id of ids) {
            expect(isPublishedEditorComponent(id)).toBe(true);
        }
    });

    test('is false for ids the running web app does not publish', () => {
        expect(isPublishedEditorComponent('not_a_real_component')).toBe(false);
        expect(isPublishedEditorComponent('')).toBe(false);
        expect(isPublishedEditorComponent('textbox')).toBe(false);
    });
});
