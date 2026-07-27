// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, render} from '@testing-library/react';
import React from 'react';

import type {
    PublishedEditorComponentId,
    PublishedFormattingBarHandle,
    PublishedSuggestionProviderId,
    PublishedWysiwygEditorHandle,
} from '@mattermost/shared/types/global';

jest.mock('components/advanced_text_editor/wysiwyg_editor/wysiwyg_editor', () => {
    const ReactMock = require('react') as typeof import('react');
    return {
        __esModule: true,
        default: ReactMock.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
            ReactMock.useImperativeHandle(ref, () => ({
                insertText: () => {},
                focus: () => {},
                blur: () => {},
                getInputBox: () => null,
                getEditor: () => null,
            }));
            return null;
        }),
    };
});

jest.mock('components/advanced_text_editor/formatting_bar/formatting_bar', () => {
    const ReactMock = require('react') as typeof import('react');
    return {
        __esModule: true,
        default: ReactMock.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
            ReactMock.useImperativeHandle(ref, () => ({
                openLinkPopover: () => {},
            }));
            return null;
        }),
    };
});

const {isPublishedEditorComponent, publishedEditorUtils, publishedSuggestionProviders} =
    require('./published_editor') as typeof import('./published_editor');

describe('publishedEditorUtils', () => {
    test('exposes the three allowlisted components', () => {
        expect(typeof publishedEditorUtils.WysiwygEditor).toBe('object');
        expect(typeof publishedEditorUtils.SuggestionList).toBe('function');
        expect(typeof publishedEditorUtils.FormattingBar).toBe('object');
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

describe('WysiwygEditor handle forwarding', () => {
    test('ref receives the published handle after Suspense resolves', async () => {
        const ref = React.createRef<PublishedWysiwygEditorHandle>();

        await act(async () => {
            render(
                <publishedEditorUtils.WysiwygEditor
                    ref={ref}
                    value=''
                    onChange={() => {}}
                    onSubmit={() => {}}
                    channelId='c'
                />,
            );
        });

        const handle = ref.current;
        expect(handle).not.toBeNull();
        expect(typeof handle!.insertText).toBe('function');
        expect(typeof handle!.focus).toBe('function');
        expect(typeof handle!.blur).toBe('function');
        expect(typeof handle!.getInputBox).toBe('function');
    });
});

describe('FormattingBar handle forwarding', () => {
    test('ref receives the published handle after Suspense resolves', async () => {
        const ref = React.createRef<PublishedFormattingBarHandle>();

        await act(async () => {
            render(
                <publishedEditorUtils.FormattingBar
                    ref={ref}
                    applyFormatting={() => {}}
                    disableControls={false}
                    location='center'
                />,
            );
        });

        expect(ref.current).not.toBeNull();
        expect(typeof ref.current!.openLinkPopover).toBe('function');
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
