// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {Editor} from '@tiptap/react';
import React from 'react';

import type {SuggestionProps} from 'components/suggestion/suggestion';
import {SuggestionContainer} from 'components/suggestion/suggestion';

import {renderWithContext} from 'tests/react_testing_utils';
import {getPxToSubstract} from 'utils/utils';

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

const mockResultsFor = (matchedPretext: string) => ({
    matchedPretext,
    terms: [...mockTerms],
    items: mockTerms.map((term) => ({suggestion: term})),
    component: mockSuggestion,
});

jest.mock('components/suggestion/command_provider/command_provider', () => ({
    __esModule: true,
    default: class {
        triggerCharacter = '/';

        handlePretextChanged(pretext: string, resultCallback: (results: any) => void) {
            if (!pretext.startsWith('/')) {
                return false;
            }

            resultCallback(mockResultsFor(pretext));
            return true;
        }
    },
}));

jest.mock('components/suggestion/at_mention_provider', () => ({
    __esModule: true,
    default: class {
        triggerCharacter = '@';

        handlePretextChanged(pretext: string, resultCallback: (results: any) => void) {
            const triggerIndex = pretext.lastIndexOf('@');
            if (triggerIndex === -1) {
                return false;
            }

            // Real AtMentionProvider lowercases matchedPretext from the captured input.
            resultCallback(mockResultsFor(pretext.slice(triggerIndex).toLowerCase()));
            return true;
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

            // Real ChannelMentionProvider lowercases matchedPretext from the captured input.
            resultCallback(mockResultsFor(pretext.slice(triggerIndex).toLowerCase()));
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

const WIDE_EDITOR = {left: 100, top: 200, right: 1100, bottom: 246, width: 1000, height: 46};

// A monospaced stand-in for the editor's text layout: the character at document position `pos` starts at
// TEXT_LEFT + pos * CHAR_WIDTH, which is what makes "measured the trigger, not the caret" observable.
const TEXT_LEFT = 116;
const CHAR_WIDTH = 8;
const LINE_HEIGHT = 20;
const FIRST_LINE_TOP = 213;

const lineWithTriggerAt = (index: number, trigger: string) => 'x'.repeat(index) + trigger;

type SetupOptions = {
    editorRect?: typeof WIDE_EDITOR;
    startOfLine?: number;
};

const setup = (terms: string[], {editorRect = WIDE_EDITOR, startOfLine = 0}: SetupOptions = {}) => {
    mockTerms.length = 0;
    mockTerms.push(...terms);

    const dom = document.createElement('div');
    dom.style.lineHeight = `${LINE_HEIGHT}px`;
    dom.getBoundingClientRect = () => editorRect as DOMRect;

    const handlers: Record<string, () => void> = {};
    const chainCalls: string[] = [];
    const inserted: string[] = [];
    const deletedRanges: Array<{from: number; to: number}> = [];
    let text = '';
    let caretLine = 0;
    let caretMeasurable = true;

    const coordsAtPos = jest.fn((pos: number) => {
        if (!caretMeasurable) {
            throw new RangeError(`no position ${pos}`);
        }

        const left = TEXT_LEFT + (pos * CHAR_WIDTH);
        const top = FIRST_LINE_TOP + (caretLine * LINE_HEIGHT);
        return {left, right: left + CHAR_WIDTH, top, bottom: top + LINE_HEIGHT};
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
                selection: {from: startOfLine + text.length, $from: {start: () => startOfLine}},
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
        type: (next: string) => act(() => {
            text = next;
            handlers.update?.();
        }),
        setCaretLine: (line: number) => {
            caretLine = line;
        },
        setCaretMeasurable: (measurable: boolean) => {
            caretMeasurable = measurable;
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

    test('replaces the matched pretext in the block the caret is in', async () => {
        const {type, inserted, deletedRanges} = setup(['~town-square'], {startOfLine: 25});

        type('hello ~tow');
        await userEvent.click(screen.getByRole('option'));

        expect(deletedRanges).toEqual([{from: 31, to: 35}]);
        expect(inserted).toEqual(['~town-square ']);
    });

    test('replaces the current mixed-case mention when an earlier lowercase one exists', async () => {
        const {type, inserted, deletedRanges} = setup(['@john.doe']);

        // 'see @john then @JOHN' — providers report matchedPretext as '@john'.
        // lastIndexOf would delete from the first @john through the caret.
        type('see @john then @JOHN');
        await userEvent.click(screen.getByRole('option'));

        expect(deletedRanges).toEqual([{from: 15, to: 20}]);
        expect(inserted).toEqual(['@john.doe ']);
    });

    test('replaces the current mixed-case channel mention when an earlier lowercase one exists', async () => {
        const {type, inserted, deletedRanges} = setup(['~town-square']);

        type('see ~town then ~TOWN');
        await userEvent.click(screen.getByRole('option'));

        expect(deletedRanges).toEqual([{from: 15, to: 20}]);
        expect(inserted).toEqual(['~town-square ']);
    });

    test('completes a mixed-case mention that does not appear in the typed case', async () => {
        const {type, inserted, deletedRanges} = setup(['@john.doe']);

        type('hello @JOHN');
        await userEvent.click(screen.getByRole('option'));

        expect(deletedRanges).toEqual([{from: 6, to: 11}]);
        expect(inserted).toEqual(['@john.doe ']);
    });

    test('replaces a Turkish İ channel mention without eating the preceding space', async () => {
        const {type, inserted, deletedRanges} = setup(['~istanbul']);

        // ChannelMentionProvider captures from pretext.toLowerCase(), so '~İ'
        // (2 UTF-16 code units) becomes matchedPretext '~i\u0307' (3 code units).
        type('draft ~İ');
        await userEvent.click(screen.getByRole('option'));

        expect(deletedRanges).toEqual([{from: 6, to: 8}]);
        expect(inserted).toEqual(['~istanbul ']);
    });

    test('does not insert the open-in-modal sentinel when no app provider can handle it', async () => {
        const {type, onSubmit, inserted, chainCalls} = setup([command + OPEN_COMMAND_IN_MODAL_ITEM_ID]);

        type(command);
        await userEvent.click(screen.getByRole('option'));

        expect(inserted).toEqual([]);
        expect(chainCalls).toEqual([]);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    test('shows nothing when a provider answers with no suggestions', () => {
        const {type} = setup([]);

        type('/jira');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    describe('alignment with the caret', () => {
        // Position 30 starts at 116 + 240, which is 356 - 100 (editor left) - 39 (the gap in front of a channel
        // name in the list) = 217px into the editor, and 13px down from its top, so still on the first line.
        test('offsets the list to the trigger character instead of the corner of the editor', () => {
            const {type} = setup(['~town-square']);

            type(lineWithTriggerAt(30, '~'));

            expect(getList()).toHaveStyle({transform: 'translate(217px, 0px)'});
        });

        test('leaves the list in the corner when the trigger is typed at the start of the line', () => {
            const {type} = setup(['~town-square']);

            type(lineWithTriggerAt(0, '~'));

            expect(getList()).toHaveStyle({transform: 'translate(0px, 0px)'});
        });

        test('keeps the list inside the editor when the trigger is near the right edge', () => {
            const {type} = setup(['~town-square']);

            type(lineWithTriggerAt(110, '~'));

            // The list is 496px wide, so it can only be moved 1000 - 496 px before it overflows the editor.
            expect(getList()).toHaveStyle({transform: 'translate(504px, 0px)'});
        });

        test('leaves the list in the corner of an editor too narrow to move it in', () => {
            const {type} = setup(['~town-square'], {editorRect: {...WIDE_EDITOR, right: 400, width: 300}});

            type(lineWithTriggerAt(20, '~'));

            expect(getList()).toHaveStyle({transform: 'translate(0px, 0px)'});
        });

        test('drops the list down to the line the trigger was typed on', () => {
            const {type, setCaretLine} = setup(['~town-square']);

            setCaretLine(1);
            type(lineWithTriggerAt(30, '~'));

            expect(getList()).toHaveStyle({transform: 'translate(217px, 33px)'});
        });

        test('measures the trigger from the start of the block the caret is in', () => {
            const {type} = setup(['~town-square'], {startOfLine: 25});

            // The trigger is the 10th character of the block, which is document position 35.
            type(lineWithTriggerAt(10, '~'));

            expect(getList()).toHaveStyle({transform: 'translate(257px, 0px)'});
        });

        test('uses the padding that belongs to the trigger character', () => {
            const {type} = setup(['@someone']);

            type(lineWithTriggerAt(30, '@'));

            // A mention row reserves room for an avatar, so it is indented further than a channel row. The exact
            // gap is derived from the root font size, so ask for it rather than hard-coding it.
            const expectedX = Math.round((TEXT_LEFT + (30 * CHAR_WIDTH)) - WIDE_EDITOR.left - getPxToSubstract('@'));
            expect(getList()).toHaveStyle({transform: `translate(${expectedX}px, 0px)`});
        });

        test('does not jump when the composer reflows while the search term is typed', () => {
            const {type, setCaretLine} = setup(['~town-square']);

            type(lineWithTriggerAt(30, '~'));
            expect(getList()).toHaveStyle({transform: 'translate(217px, 0px)'});

            // The extra characters push the composer onto another line, carrying the trigger down with them.
            setCaretLine(1);
            type(`${lineWithTriggerAt(30, '~')}tow`);

            expect(getList()).toHaveStyle({transform: 'translate(217px, 0px)'});
        });

        test('follows a second trigger typed further along the line', () => {
            const {type} = setup(['~town-square']);

            type(lineWithTriggerAt(30, '~'));

            // The second tilde lands on position 43, which is 321px into the editor.
            type(`${lineWithTriggerAt(30, '~')}town-square ~`);

            expect(getList()).toHaveStyle({transform: 'translate(321px, 0px)'});
        });

        test('aligns to the current mixed-case mention instead of an earlier lowercase one', () => {
            const {type} = setup(['@someone']);

            // Second @ is at index 21. lastIndexOf('@john') would measure the first @ at 10.
            type(`${'x'.repeat(10)}@john then @JOHN`);

            const expectedX = Math.round((TEXT_LEFT + (21 * CHAR_WIDTH)) - WIDE_EDITOR.left - getPxToSubstract('@'));
            expect(getList()).toHaveStyle({transform: `translate(${expectedX}px, 0px)`});
        });

        test('aligns to the tilde of a Turkish İ mention whose lowercased pretext is longer', () => {
            const {type} = setup(['~istanbul']);

            type('draft ~İ');

            // Trigger is at index 6 (`~`), not 5 (the space that subtracting
            // matchedPretext.length would pick when '~İ' lowercases to '~i\u0307').
            const expectedX = Math.round((TEXT_LEFT + (6 * CHAR_WIDTH)) - WIDE_EDITOR.left - getPxToSubstract('~'));
            expect(getList()).toHaveStyle({transform: `translate(${expectedX}px, 0px)`});
        });

        test('measures again after the list has been closed and reopened', () => {
            const {type, setCaretLine} = setup(['~town-square']);

            type(lineWithTriggerAt(30, '~'));
            expect(getList()).toHaveStyle({transform: 'translate(217px, 0px)'});

            type('x'.repeat(30));
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

            // The composer grew a line while the list was closed, so the same trigger is now lower down.
            setCaretLine(1);
            type(lineWithTriggerAt(30, '~'));

            expect(getList()).toHaveStyle({transform: 'translate(217px, 33px)'});
        });

        test('falls back to the corner of the editor when the caret cannot be measured, then recovers', () => {
            const {type, setCaretMeasurable} = setup(['~town-square']);

            setCaretMeasurable(false);
            type(lineWithTriggerAt(30, '~'));

            expect(getList()).toBeVisible();
            expect(getList().style.transform).toBe('');

            setCaretMeasurable(true);
            type(`${lineWithTriggerAt(30, '~')}town-square ~`);

            expect(getList()).toHaveStyle({transform: 'translate(321px, 0px)'});
        });
    });
});
