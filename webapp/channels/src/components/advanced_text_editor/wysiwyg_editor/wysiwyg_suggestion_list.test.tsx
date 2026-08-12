// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {Editor} from '@tiptap/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import WysiwygSuggestionList from './wysiwyg_suggestion_list';

const EXECUTE_CURRENT_COMMAND_ITEM_ID = '_execute_current_command';
const OPEN_COMMAND_IN_MODAL_ITEM_ID = '_open_command_in_modal';

const mockTerms: string[] = [];

jest.mock('components/suggestion/command_provider/command_provider', () => ({
    __esModule: true,
    default: class {
        handlePretextChanged(pretext: string, resultCallback: (results: any) => void) {
            if (!pretext.startsWith('/')) {
                return false;
            }

            resultCallback({
                matchedPretext: pretext,
                terms: mockTerms,
                items: mockTerms.map((term) => ({suggestion: term})),
                component: () => null,
            });
            return true;
        }
    },
}));

jest.mock('components/suggestion/at_mention_provider', () => ({
    __esModule: true,
    default: class {
        handlePretextChanged() {
            return false;
        }
    },
}));

jest.mock('components/suggestion/channel_mention_provider', () => ({
    __esModule: true,
    default: class {
        handlePretextChanged() {
            return false;
        }
    },
}));

jest.mock('components/suggestion/emoticon_provider', () => ({
    __esModule: true,
    default: class {
        handlePretextChanged() {
            return false;
        }
    },
}));

jest.mock('components/suggestion/suggestion_list', () => ({
    __esModule: true,
    default: ({open, pretext, results, onCompleteWord}: any) => (open ? (
        <div>
            {results.terms.map((term: string) => (
                <button
                    key={term}
                    onClick={() => onCompleteWord(term, pretext)}
                >
                    {term}
                </button>
            ))}
        </div>
    ) : null),
}));

const setup = (terms: string[]) => {
    mockTerms.length = 0;
    mockTerms.push(...terms);

    const dom = document.createElement('div');
    const handlers: Record<string, () => void> = {};
    const chainCalls: string[] = [];
    const inserted: string[] = [];
    let text = '';

    const chain: any = {
        focus: () => chain,
        deleteRange: () => chain,
        clearContent: () => {
            chainCalls.push('clearContent');
            return chain;
        },
        insertContent: (content: string) => {
            inserted.push(content);
            return chain;
        },
        run: () => true,
    };

    const editor = {
        isDestroyed: false,
        view: {dom},
        commands: {focus: jest.fn()},
        chain: () => chain,
        get state() {
            return {
                selection: {from: text.length, $from: {start: () => 0}},
                doc: {textBetween: () => text},
            };
        },
        on: (event: string, handler: () => void) => {
            handlers[event] = handler;
        },
        off: () => undefined,
    } as unknown as Editor;

    const onSubmit = jest.fn();

    renderWithContext(
        <WysiwygSuggestionList
            editor={editor}
            channelId='channel1'
            onSubmit={onSubmit}
        />,
    );

    return {
        onSubmit,
        inserted,
        chainCalls,
        type: (next: string) => act(() => {
            text = next;
            handlers.update?.();
        }),
    };
};

describe('WysiwygSuggestionList', () => {
    const command = '/jira instance install cloud-oauth ';

    test('executes the command instead of inserting the sentinel', async () => {
        const {type, onSubmit, inserted} = setup([command + EXECUTE_CURRENT_COMMAND_ITEM_ID]);

        type(command);
        await userEvent.click(screen.getByRole('button'));

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(inserted).toEqual([]);
    });

    test('completes a regular suggestion as text', async () => {
        const {type, onSubmit, inserted} = setup(['/jira instance install cloud-oauth']);

        type('/jira instance install ');
        await userEvent.click(screen.getByRole('button'));

        expect(inserted).toEqual(['/jira instance install cloud-oauth ']);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    test('does not insert the open-in-modal sentinel when no app provider can handle it', async () => {
        const {type, onSubmit, inserted, chainCalls} = setup([command + OPEN_COMMAND_IN_MODAL_ITEM_ID]);

        type(command);
        await userEvent.click(screen.getByRole('button'));

        expect(inserted).toEqual([]);
        expect(chainCalls).toEqual([]);
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
