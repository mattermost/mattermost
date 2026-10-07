// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {Editor} from '@tiptap/react';
import React from 'react';

import type {SuggestionProps} from 'components/suggestion/suggestion';
import {SuggestionContainer} from 'components/suggestion/suggestion';

import {renderWithContext} from 'tests/react_testing_utils';

import WysiwygSuggestionList from './wysiwyg_suggestion_list';

const EXECUTE_CURRENT_COMMAND_ITEM_ID = '_execute_current_command';
const OPEN_COMMAND_IN_MODAL_ITEM_ID = '_open_command_in_modal';

const mockTerms: string[] = [];

const mockSuggestion = React.forwardRef<HTMLLIElement, SuggestionProps<string>>((props, ref) => (
    <SuggestionContainer
        ref={ref}
        {...props}
    >
        {props.term}
    </SuggestionContainer>
));
mockSuggestion.displayName = 'MockSuggestion';

jest.mock('components/suggestion/command_provider/command_provider', () => ({
    __esModule: true,
    default: class {
        triggerCharacter = '/';

        handlePretextChanged(pretext: string, resultCallback: (results: any) => void) {
            if (!pretext.startsWith('/')) {
                return false;
            }

            resultCallback({
                matchedPretext: pretext,
                terms: [...mockTerms],
                items: mockTerms.map((term) => ({suggestion: term})),
                component: mockSuggestion,
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
        triggerCharacter = '~';

        handlePretextChanged(pretext: string, resultCallback: (results: any) => void) {
            const triggerIndex = pretext.lastIndexOf('~');
            if (triggerIndex === -1) {
                return false;
            }

            resultCallback({
                matchedPretext: pretext.slice(triggerIndex),
                terms: [...mockTerms],
                items: mockTerms.map((term) => ({suggestion: term})),
                component: mockSuggestion,
            });
            return true;
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

const EDITOR_RECT = {left: 100, top: 200, right: 1100, bottom: 246, width: 1000, height: 46};

// Enough of a ProseMirror editor for the suggestion list: a single line of text whose caret sits at the end of it,
// and a caret geometry that the test controls.
const setup = (terms: string[]) => {
    mockTerms.length = 0;
    mockTerms.push(...terms);

    const dom = document.createElement('div');
    dom.style.lineHeight = '20px';
    dom.getBoundingClientRect = () => EDITOR_RECT as DOMRect;

    const handlers: Record<string, () => void> = {};
    const chainCalls: string[] = [];
    const inserted: string[] = [];
    const deletedRanges: Array<{from: number; to: number}> = [];
    let text = '';
    let caretCoords = {left: 400, top: 213, right: 400, bottom: 233};
    let caretMeasurementFails = false;

    const coordsAtPos = jest.fn((pos: number) => {
        if (caretMeasurementFails) {
            throw new RangeError(`no position ${pos}`);
        }
        return caretCoords;
    });

    const chain: any = {
        focus: () => chain,
        deleteRange: (range: {from: number; to: number}) => {
            deletedRanges.push(range);
            return chain;
        },
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
        view: {dom, coordsAtPos},
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
        deletedRanges,
        chainCalls,
        coordsAtPos,
        type: (next: string) => act(() => {
            text = next;
            handlers.update?.();
        }),
        moveCaretTo: (left: number, top: number) => {
            caretCoords = {left, top, right: left, bottom: top + 20};
        },
        setCaretMeasurable: (measurable: boolean) => {
            caretMeasurementFails = !measurable;
        },
    };
};

const getList = () => screen.getByRole('listbox');

describe('WysiwygSuggestionList', () => {
    const command = '/jira instance install cloud-oauth ';

    test('executes the command instead of inserting the sentinel', async () => {
        const {type, onSubmit, inserted} = setup([command + EXECUTE_CURRENT_COMMAND_ITEM_ID]);

        type(command);
        await userEvent.click(screen.getByRole('option'));

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(inserted).toEqual([]);
    });

    test('completes a regular suggestion as text', async () => {
        const {type, onSubmit, inserted} = setup(['/jira instance install cloud-oauth']);

        type('/jira instance install ');
        await userEvent.click(screen.getByRole('option'));

        expect(inserted).toEqual(['/jira instance install cloud-oauth ']);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    test('replaces the matched pretext rather than the whole line', async () => {
        const {type, inserted, deletedRanges} = setup(['~town-square']);

        type('hello ~tow');
        await userEvent.click(screen.getByRole('option'));

        expect(deletedRanges).toEqual([{from: 6, to: 10}]);
        expect(inserted).toEqual(['~town-square ']);
    });

    test('does not insert the open-in-modal sentinel when no app provider can handle it', async () => {
        const {type, onSubmit, inserted, chainCalls} = setup([command + OPEN_COMMAND_IN_MODAL_ITEM_ID]);

        type(command);
        await userEvent.click(screen.getByRole('option'));

        expect(inserted).toEqual([]);
        expect(chainCalls).toEqual([]);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    describe('alignment with the caret', () => {
        test('offsets the list to the trigger character instead of the corner of the editor', () => {
            const {type, moveCaretTo} = setup(['~town-square']);

            moveCaretTo(400, 213);
            type('hello ~');

            // 400 - 100 (editor left) - 39 (the padding in front of a channel name) and still on the first line.
            expect(getList()).toHaveStyle({transform: 'translate(261px, 0px)'});
        });

        test('keeps the list inside the editor when the trigger is near the right edge', () => {
            const {type, moveCaretTo} = setup(['~town-square']);

            moveCaretTo(1000, 213);
            type('hello ~');

            // The list is 496px wide, so it can only be moved 1000 - 496 px to the right before it overflows.
            expect(getList()).toHaveStyle({transform: 'translate(504px, 0px)'});
        });

        test('drops the list down to the line the trigger was typed on', () => {
            const {type, moveCaretTo} = setup(['~town-square']);

            moveCaretTo(150, 233);
            type('hello ~');

            expect(getList()).toHaveStyle({transform: 'translate(11px, 33px)'});
        });

        test('holds its place while the search term is typed', () => {
            const {type, moveCaretTo, coordsAtPos} = setup(['~town-square']);

            moveCaretTo(400, 213);
            type('hello ~');

            moveCaretTo(460, 213);
            type('hello ~tow');

            expect(coordsAtPos).toHaveBeenCalledTimes(1);
            expect(getList()).toHaveStyle({transform: 'translate(261px, 0px)'});
        });

        test('follows a second trigger typed further along the line', () => {
            const {type, moveCaretTo} = setup(['~town-square']);

            moveCaretTo(400, 213);
            type('hello ~');

            moveCaretTo(500, 213);
            type('hello ~town-square ~');

            expect(getList()).toHaveStyle({transform: 'translate(361px, 0px)'});
        });

        test('measures again after the list has been closed and reopened', () => {
            const {type, moveCaretTo} = setup(['~town-square']);

            moveCaretTo(400, 213);
            type('hello ~');

            type('hello ');
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

            moveCaretTo(250, 213);
            type('hello ~');

            expect(getList()).toHaveStyle({transform: 'translate(111px, 0px)'});
        });

        test('falls back to the corner of the editor when the caret cannot be measured, then recovers', () => {
            const {type, moveCaretTo, setCaretMeasurable} = setup(['~town-square']);

            setCaretMeasurable(false);
            type('hello ~');

            expect(getList()).toBeVisible();
            expect(getList().style.transform).toBe('');

            setCaretMeasurable(true);
            moveCaretTo(400, 213);
            type('hello ~town-square ~');

            expect(getList()).toHaveStyle({transform: 'translate(261px, 0px)'});
        });
    });
});
