// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';

import * as UserAgent from '@mattermost/shared/utils/user_agent';

import {act, fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import SuggestionBox from './suggestion_box';

import AtMentionProvider from '../at_mention_provider';
import type {ResultsCallback} from '../provider';
import Provider from '../provider';
import type {SuggestionProps} from '../suggestion';
import {SuggestionContainer} from '../suggestion';
import SuggestionList from '../suggestion_list';

type SuggestionBoxAlgn = {lineHeight?: number; pixelsToMoveX?: number; pixelsToMoveY?: number};

const defaultSuggestionBoxAlgn: SuggestionBoxAlgn = {pixelsToMoveX: 0, pixelsToMoveY: 0};
const mockGetSuggestionBoxAlgn = jest.fn((): SuggestionBoxAlgn => defaultSuggestionBoxAlgn);

jest.mock('utils/utils', () => ({
    ...jest.requireActual('utils/utils'),
    getSuggestionBoxAlgn: (...args: unknown[]) => mockGetSuggestionBoxAlgn(...args as []),
}));

beforeEach(() => {
    mockGetSuggestionBoxAlgn.mockClear();
    mockGetSuggestionBoxAlgn.mockReturnValue(defaultSuggestionBoxAlgn);
});

const EXECUTE_CURRENT_COMMAND_ITEM_ID = Constants.Integrations.EXECUTE_CURRENT_COMMAND_ITEM_ID;
const OPEN_COMMAND_IN_MODAL_ITEM_ID = Constants.Integrations.OPEN_COMMAND_IN_MODAL_ITEM_ID;

function TestWrapper(props: React.ComponentPropsWithoutRef<typeof SuggestionBox>) {
    // eslint-disable-next-line react/prop-types
    const [value, setValue] = useState(props.value);

    const handleChange = useCallback((e: React.FormEvent) => setValue((e.target as HTMLInputElement).value), []);

    return (
        <SuggestionBox
            {...props}
            onChange={handleChange}
            value={value}
        />
    );
}

const TestSuggestion = React.forwardRef<HTMLLIElement, SuggestionProps<string>>((props, ref) => {
    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            {'Suggestion: ' + props.term}
        </SuggestionContainer>
    );
});
TestSuggestion.displayName = 'TestSuggestion';

class TestProvider extends Provider {
    private repeatResults: boolean;

    constructor(repeatResults = false) {
        super();

        this.repeatResults = repeatResults;
    }

    handlePretextChanged(pretext: string, resultCallback: ResultsCallback<string>) {
        if (pretext.trim().length === 0) {
            return false;
        }

        const terms = [pretext + pretext];
        resultCallback({
            matchedPretext: pretext,
            terms,
            items: terms,
            component: TestSuggestion,
        });

        if (this.repeatResults) {
            setTimeout(() => {
                resultCallback({
                    matchedPretext: pretext,
                    terms,
                    items: terms,
                    component: TestSuggestion,
                });
            }, 10);
        }

        return true;
    }
}

type FixedProviderOptions = {

    /** The full set of terms this provider can return. Terms are filtered by the matched pretext. */
    terms?: string[];

    /** When set, the provider only handles pretexts containing this character, matching from its last occurrence. */
    trigger?: string;

    /** Returned from presentationType(), which decides whether the list or the date component is rendered. */
    presentation?: string;

    /** When there's no trigger, whether an empty pretext should be handled instead of ignored. */
    allowEmpty?: boolean;
};

/**
 * A provider which returns a predetermined set of terms, filtered by whatever the user has typed. Unlike TestProvider,
 * this allows a test to control exactly which suggestions appear and in what order.
 */
class FixedProvider extends Provider {
    private options: FixedProviderOptions;

    // Optional provider hooks that SuggestionBox calls when a provider implements them
    handleCompleteWord?: jest.Mock;
    openAppsModalFromCommand?: jest.Mock;

    constructor(options: FixedProviderOptions = {}) {
        super();

        this.options = options;
        this.triggerCharacter = options.trigger;
    }

    handlePretextChanged(pretext: string, resultCallback: ResultsCallback<string>) {
        const {trigger, terms = [], allowEmpty = false} = this.options;

        let matchedPretext = pretext;
        if (trigger) {
            const triggerIndex = pretext.lastIndexOf(trigger);
            if (triggerIndex === -1) {
                return false;
            }

            matchedPretext = pretext.substring(triggerIndex);
        } else if (!allowEmpty && pretext.trim().length === 0) {
            return false;
        }

        const matched = terms.filter((term) => term.toLowerCase().startsWith(matchedPretext.toLowerCase()));

        resultCallback({
            matchedPretext,
            terms: matched,
            items: matched,
            component: TestSuggestion,
        });

        return true;
    }

    presentationType() {
        return this.options.presentation ?? 'text';
    }
}

function TestDateComponent() {
    return <div>{'date component'}</div>;
}

describe('SuggestionBox', () => {
    function makeBaseProps(): React.ComponentProps<typeof SuggestionBox> {
        return {
            listComponent: SuggestionList,
            value: '',
            providers: [],
            actions: {
                addMessageIntoHistory: jest.fn(),
            },
            placeholder: 'test input',
        };
    }

    function getInput() {
        return screen.getByPlaceholderText('test input');
    }

    /** Renders a SuggestionBox alongside a button so that tests can move focus out of the suggestion box. */
    function renderWithOutsideButton(props: React.ComponentProps<typeof SuggestionBox>) {
        return renderWithContext(
            <>
                <TestWrapper {...props}/>
                <button>{'outside'}</button>
            </>,
        );
    }

    test('should list suggestions based on typed text', async () => {
        const provider = new TestProvider();
        const providerSpy = jest.spyOn(provider, 'handlePretextChanged');

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
        );

        // Start with no suggestions rendered
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        // Typing some text should cause a suggestion to be shown
        await userEvent.click(getInput());
        await userEvent.keyboard('test');

        await waitFor(() => {
            // Note that debouncing causes the provider to only be called once when the user stops typing
            expect(providerSpy).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBeVisible();
            expect(screen.getByText('Suggestion: testtest')).toBeVisible();
        });

        // Typing more text should cause the suggestion to be updaetd
        await userEvent.keyboard('words');

        await waitFor(() => {
            expect(providerSpy).toHaveBeenCalledTimes(2);
        });

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBeVisible();
            expect(screen.getByText('Suggestion: testwordstestwords')).toBeVisible();
        });

        // Clearing the textbox hides all suggestions
        await userEvent.clear(getInput());

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('should hide suggestions on pressing escape', async () => {
        const provider = new TestProvider();

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
        );

        // Start with no suggestions rendered
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        // Typing some text should cause a suggestion to be shown
        await userEvent.click(getInput());
        await userEvent.keyboard('test');

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeVisible();
        });

        // Pressing escape hides all suggestions
        await userEvent.keyboard('{escape}');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('should show suggestions again after typing following an escape', async () => {
        const provider = new TestProvider();

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
        );

        await userEvent.click(getInput());
        await userEvent.keyboard('test');

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeVisible();
        });

        await userEvent.keyboard('{escape}');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        await userEvent.keyboard('ing');

        await waitFor(() => {
            expect(screen.getByText('Suggestion: testingtesting')).toBeVisible();
        });
    });

    test('should autocomplete suggestions by pressing enter', async () => {
        const provider = new TestProvider();

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
        );

        // Typing some text should cause a suggestion to be shown
        await userEvent.click(getInput());
        await userEvent.keyboard('test');

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBeVisible();
            expect(screen.getByText('Suggestion: testtest')).toBeVisible();
        });

        // Pressing enter should update the textbox value and hide the suggestion list
        await userEvent.keyboard('{enter}');

        await waitFor(() => {
            expect(getInput()).toHaveValue('testtest ');
        });

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('MM-57320 completing text with enter and calling resultCallback twice should not erase text following caret', async () => {
        const provider = new TestProvider(true);
        const onSuggestionsReceived = jest.fn();

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
                onSuggestionsReceived={onSuggestionsReceived}
            />,
        );

        await userEvent.click(getInput());
        await userEvent.keyboard('This is important');

        // The provider will send results to the SuggestionBox twice to simulate loading results from the server
        await waitFor(() => {
            expect(onSuggestionsReceived).toHaveBeenCalledTimes(2);
        });

        onSuggestionsReceived.mockClear();

        expect(getInput()).toHaveValue('This is important');
        expect(screen.getByRole('listbox')).toBeVisible();
        expect(screen.getByText('Suggestion: This is importantThis is important')).toBeVisible();

        // Move the caret back to the start of the textbox and then use escape to clear the suggestions because
        // we don't support moving the caret with the autocomplete open yet
        await userEvent.keyboard('{home}{escape}');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        // Type a space and then start typing something again to show results
        onSuggestionsReceived.mockClear();

        await userEvent.keyboard('@us');

        await waitFor(() => {
            expect(onSuggestionsReceived).toHaveBeenCalledTimes(2);
        });

        expect(screen.getByRole('listbox')).toBeVisible();
        expect(screen.getByText('Suggestion: @us@us')).toBeVisible();

        onSuggestionsReceived.mockClear();

        // Type some more and then hit enter before the second set of results is received
        await userEvent.keyboard('e{enter}');

        await waitFor(() => {
            expect(getInput()).toHaveValue('@use@use This is important');
        });

        // Wait for the second set of results has been received to ensure the contents of the textbox aren't lost
        await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

        // expect(onSuggestionsReceived).toHaveBeenCalledTimes(1);
        expect(getInput()).toHaveValue('@use@use This is important');
    });

    test('keyboard support and ARIA', async () => {
        const channelId = 'channelId';
        const userA = TestHelper.getUserMock({id: 'userA', username: 'apple'});
        const userB = TestHelper.getUserMock({id: 'userB', username: 'banana'});

        const provider = new AtMentionProvider({
            autocompleteGroups: null,
            autocompleteUsersInChannel: jest.fn().mockResolvedValue({data: []}),
            priorityProfiles: [],
            channelId: 'channelId',
            currentUserId: 'currentUserId',
            searchAssociatedGroupsForReference: jest.fn().mockResolvedValue({data: []}),
            useChannelMentions: false,
        });

        renderWithContext(
            <TestWrapper
                {...makeBaseProps()}
                providers={[provider]}
            />,
            {
                entities: {
                    users: {
                        profilesInChannel: {
                            [channelId]: new Set([userA.id, userB.id]),
                        },
                        profiles: {
                            [userA.id]: userA,
                            [userB.id]: userB,
                        },
                    },
                },
            },
        );

        const input = getInput();
        await userEvent.click(input);

        // Start without showing the autocomplete list
        expect(input).toHaveAttribute('aria-autocomplete', 'list');
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById(input.getAttribute('aria-controls')!)).not.toBeInTheDocument();

        // Type something that shouldn't trigger the autocomplete
        await userEvent.keyboard('Test ');

        // The autocomplete still shouldn't be visible
        expect(input).toHaveAttribute('aria-autocomplete', 'list');
        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById(input.getAttribute('aria-controls')!)).not.toBeInTheDocument();

        // Type an at sign to trigger the user autocomplete
        await userEvent.keyboard('@');

        await waitFor(() => {
            expect(input).toHaveAttribute('aria-expanded', 'true');
        });

        // Ensure that the input is correctly linked to the suggestion list
        expect(document.getElementById(input.getAttribute('aria-controls')!)).toBe(screen.getByRole('listbox'));
        expect(input.getAttribute('aria-activedescendant')).toBe(
            screen.getByRole('group', {name: 'Channel Members'}).firstElementChild!.nextElementSibling!.id,
        );

        // The number of results should also be read out
        expect(screen.getByRole('status')).toHaveTextContent('2 suggestions available');

        // Pressing the down arrow should change the selection to the second user
        await userEvent.keyboard('{arrowdown}');

        expect(input.getAttribute('aria-activedescendant')).toBe(
            screen.getByRole('group', {name: 'Channel Members'}).lastElementChild!.id,
        );

        // Pressing the up arrow should change the selection back to the first user
        await userEvent.keyboard('{arrowup}');

        expect(input.getAttribute('aria-activedescendant')).toBe(
            screen.getByRole('group', {name: 'Channel Members'}).firstElementChild!.nextElementSibling!.id,
        );

        // Pressing enter should complete the result and close the suggestions
        await userEvent.keyboard('{enter}');

        expect(input).toHaveValue('Test @apple ');

        expect(input).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById(input.getAttribute('aria-controls')!)).not.toBeInTheDocument();
        expect(input).not.toHaveAttribute('aria-activedescendant');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    describe('keyboard navigation', () => {
        function makeMentionProvider() {
            return new FixedProvider({
                trigger: '@',
                terms: ['@apple', '@banana', '@cherry'],
            });
        }

        async function showSuggestions() {
            await userEvent.click(getInput());
            await userEvent.keyboard('@');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });
        }

        test('should select the first suggestion by default', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                />,
            );

            await showSuggestions();

            expect(screen.getByTestId('suggestion-selected')).toHaveTextContent('Suggestion: @apple');
        });

        test('should stop at the last suggestion when pressing the down arrow repeatedly', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                />,
            );

            await showSuggestions();

            await userEvent.keyboard('{arrowdown}{arrowdown}{arrowdown}{arrowdown}');

            expect(screen.getByTestId('suggestion-selected')).toHaveTextContent('Suggestion: @cherry');
        });

        test('should stop at the first suggestion when pressing the up arrow repeatedly', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                />,
            );

            await showSuggestions();

            await userEvent.keyboard('{arrowdown}{arrowup}{arrowup}{arrowup}');

            expect(screen.getByTestId('suggestion-selected')).toHaveTextContent('Suggestion: @apple');
        });

        test('should complete the selected suggestion when pressing tab', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                />,
            );

            await showSuggestions();

            await userEvent.keyboard('{arrowdown}{tab}');

            await waitFor(() => {
                expect(getInput()).toHaveValue('@banana ');
            });
        });

        test('should not complete the selected suggestion when pressing tab with completeOnTab disabled', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                    completeOnTab={false}
                />,
            );

            await showSuggestions();

            await userEvent.keyboard('{tab}');

            expect(getInput()).toHaveValue('@');
        });

        test('should not complete the selected suggestion when pressing enter with a modifier held', async () => {
            const onKeyDown = jest.fn();

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                    onKeyDown={onKeyDown}
                />,
            );

            await showSuggestions();

            await userEvent.keyboard('{Control>}{Enter}{/Control}');

            expect(getInput()).toHaveValue('@');
            expect(screen.getByRole('listbox')).toBeVisible();
            expect(onKeyDown).toHaveBeenCalled();
        });

        test('should pass key presses through to onKeyDown when no suggestions are shown', async () => {
            const onKeyDown = jest.fn();

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[]}
                    onKeyDown={onKeyDown}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('{arrowdown}{enter}');

            expect(onKeyDown).toHaveBeenCalledTimes(2);
        });
    });

    describe('completing a suggestion', () => {
        function makeMentionProvider() {
            return new FixedProvider({
                trigger: '@',
                terms: ['@apple', '@banana'],
            });
        }

        test('should complete a suggestion when it is clicked', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('@');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('option', {name: 'Suggestion: @banana'}));

            await waitFor(() => {
                expect(getInput()).toHaveValue('@banana ');
            });

            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });

        test('should change the selection when a suggestion is hovered', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('@');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            expect(screen.getByTestId('suggestion-selected')).toHaveTextContent('Suggestion: @apple');

            fireEvent.mouseMove(screen.getByRole('option', {name: 'Suggestion: @banana'}));

            expect(screen.getByTestId('suggestion-selected')).toHaveTextContent('Suggestion: @banana');
        });

        test('should call onItemSelected with the completed item', async () => {
            const onItemSelected = jest.fn();

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                    onItemSelected={onItemSelected}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('@a');

            await waitFor(() => {
                expect(screen.getByText('Suggestion: @apple')).toBeVisible();
            });

            await userEvent.keyboard('{enter}');

            await waitFor(() => {
                expect(onItemSelected).toHaveBeenCalledWith('@apple');
            });
        });

        test("should call the provider's handleCompleteWord after completing", async () => {
            const provider = makeMentionProvider();
            provider.handleCompleteWord = jest.fn();

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[provider]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('@a');

            await waitFor(() => {
                expect(screen.getByText('Suggestion: @apple')).toBeVisible();
            });

            await userEvent.keyboard('{enter}');

            await waitFor(() => {
                expect(provider.handleCompleteWord).toHaveBeenCalledWith('@apple', '@a', expect.any(Function));
            });
        });

        test('should complete using fresh results when enter is pressed before the debounce fires', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('@');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            // Type another character and press enter before the provider has had a chance to return results for it,
            // so the pretext no longer matches the pretext the current results were generated from
            await userEvent.keyboard('b{enter}');

            await waitFor(() => {
                expect(getInput()).toHaveValue('@banana ');
            });
        });

        test('should keep the text following the caret when completing', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('hello world');

            // Move the caret back to the start of the input before typing the mention
            await userEvent.keyboard('{home}@a');

            await waitFor(() => {
                expect(screen.getByText('Suggestion: @apple')).toBeVisible();
            });

            await userEvent.keyboard('{enter}');

            await waitFor(() => {
                expect(getInput()).toHaveValue('@apple hello world');
            });
        });

        test('should replace the entire input when replaceAllInputOnSelect is set', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                    replaceAllInputOnSelect={true}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('hello @a');

            await waitFor(() => {
                expect(screen.getByText('Suggestion: @apple')).toBeVisible();
            });

            await userEvent.keyboard('{enter}');

            await waitFor(() => {
                expect(getInput()).toHaveValue('@apple');
            });
        });
    });

    describe('slash command items', () => {
        test('should submit the command without completing text for an execute-current-command item', async () => {
            const onKeyPress = jest.fn();
            const provider = new FixedProvider({
                trigger: '/',
                terms: ['/away' + EXECUTE_CURRENT_COMMAND_ITEM_ID],
            });

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[provider]}
                    onKeyPress={onKeyPress}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('/aw');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            await userEvent.keyboard('{enter}');

            await waitFor(() => {
                expect(onKeyPress).toHaveBeenCalled();
            });

            // The command shouldn't have been completed into the textbox since it was submitted instead
            expect(getInput()).toHaveValue('/aw');
        });

        test('should open the apps modal and clear the input for an open-command-in-modal item', async () => {
            const provider = new FixedProvider({
                trigger: '/',
                terms: ['/away' + OPEN_COMMAND_IN_MODAL_ITEM_ID],
            });
            provider.openAppsModalFromCommand = jest.fn();

            const props = makeBaseProps();

            renderWithContext(
                <TestWrapper
                    {...props}
                    providers={[provider]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('/aw');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            await userEvent.keyboard('{enter}');

            await waitFor(() => {
                expect(provider.openAppsModalFromCommand).toHaveBeenCalledWith('/away');
            });

            expect(props.actions.addMessageIntoHistory).toHaveBeenCalledWith('/away');
            expect(getInput()).toHaveValue('');
        });
    });

    describe('focus and blur', () => {
        function makeMentionProvider() {
            return new FixedProvider({
                trigger: '@',
                terms: ['@apple', '@banana'],
            });
        }

        test('should hide suggestions when focus leaves the suggestion box', async () => {
            const onBlur = jest.fn();

            renderWithOutsideButton({
                ...makeBaseProps(),
                providers: [makeMentionProvider()],
                onBlur,
            });

            await userEvent.click(getInput());
            await userEvent.keyboard('@');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'outside'}));

            await waitFor(() => {
                expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
            });

            expect(onBlur).toHaveBeenCalled();
        });

        test('should keep suggestions when focus leaves and forceSuggestionsWhenBlur is set', async () => {
            const onBlur = jest.fn();

            renderWithOutsideButton({
                ...makeBaseProps(),
                providers: [makeMentionProvider()],
                forceSuggestionsWhenBlur: true,
                onBlur,
            });

            await userEvent.click(getInput());
            await userEvent.keyboard('@');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'outside'}));

            expect(onBlur).toHaveBeenCalled();
            expect(screen.getByRole('listbox')).toBeVisible();
        });

        test('should show suggestions on focus when openWhenEmpty is set', async () => {
            const provider = new FixedProvider({
                terms: ['alpha', 'beta'],
                allowEmpty: true,
            });

            renderWithOutsideButton({
                ...makeBaseProps(),
                providers: [provider],
                openWhenEmpty: true,
            });

            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

            await userEvent.click(getInput());

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            expect(screen.getByText('Suggestion: alpha')).toBeVisible();
        });

        test('should call onFocus when the suggestion box gains focus', async () => {
            const onFocus = jest.fn();

            renderWithOutsideButton({
                ...makeBaseProps(),
                providers: [makeMentionProvider()],
                onFocus,
            });

            await userEvent.click(getInput());

            expect(onFocus).toHaveBeenCalledTimes(1);
        });

        test('should keep suggestions open when tapping outside of the box on iOS', async () => {
            const isIos = jest.spyOn(UserAgent, 'isIos').mockReturnValue(true);
            const onBlur = jest.fn();

            try {
                renderWithContext(
                    <TestWrapper
                        {...makeBaseProps()}
                        providers={[makeMentionProvider()]}
                        onBlur={onBlur}
                    />,
                );

                await userEvent.click(getInput());
                await userEvent.keyboard('@');

                await waitFor(() => {
                    expect(screen.getByRole('listbox')).toBeVisible();
                });

                // On Safari and the iOS classic app, tapping outside of the textbox produces a focusout with no
                // related target, and the autocomplete is expected to stay open
                fireEvent.focusOut(getInput(), {relatedTarget: null});

                expect(screen.getByRole('listbox')).toBeVisible();
                expect(onBlur).not.toHaveBeenCalled();
            } finally {
                isIos.mockRestore();
            }
        });

        test('should not react to focus moving to a child of the suggestion box', async () => {
            const onBlur = jest.fn();

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[makeMentionProvider()]}
                    onBlur={onBlur}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('@');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            fireEvent.focusOut(getInput(), {relatedTarget: screen.getByRole('listbox')});

            expect(screen.getByRole('listbox')).toBeVisible();
            expect(onBlur).not.toHaveBeenCalled();
        });
    });

    describe('showing and hiding the list', () => {
        test('should not show the list until requiredCharacters have been typed', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[new TestProvider()]}
                    requiredCharacters={5}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('test');

            await waitFor(() => {
                expect(getInput()).toHaveValue('test');
            });

            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

            await userEvent.keyboard('s');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });
        });

        test('should show a no results message when renderNoResults is set', async () => {
            const provider = new FixedProvider({
                trigger: '@',
                terms: [],
            });

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[provider]}
                    renderNoResults={true}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('@zzz');

            await waitFor(() => {
                expect(screen.getByText(/No items match/)).toBeVisible();
            });
        });

        test('should render the date component instead of the list for date providers', async () => {
            const provider = new FixedProvider({
                trigger: '@',
                terms: ['@apple'],
                presentation: 'date',
            });

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[provider]}
                    dateComponent={TestDateComponent}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('@a');

            await waitFor(() => {
                expect(screen.getByText('date component')).toBeVisible();
            });

            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        });
    });

    describe('pretext handling', () => {
        test('should search the complete text when shouldSearchCompleteText is set', async () => {
            const provider = new FixedProvider({terms: []});
            const providerSpy = jest.spyOn(provider, 'handlePretextChanged');

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[provider]}
                    shouldSearchCompleteText={true}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('hello');

            // Move the caret to the start of the input and type, leaving text after the caret
            await userEvent.keyboard('{home}x');

            await waitFor(() => {
                expect(providerSpy).toHaveBeenLastCalledWith('xhello', expect.any(Function));
            });
        });

        test('should only search up to the caret by default', async () => {
            const provider = new FixedProvider({terms: []});
            const providerSpy = jest.spyOn(provider, 'handlePretextChanged');

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[provider]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('hello');

            await userEvent.keyboard('{home}x');

            await waitFor(() => {
                expect(providerSpy).toHaveBeenLastCalledWith('x', expect.any(Function));
            });
        });

        test('should query the providers on mount', async () => {
            const provider = new FixedProvider({terms: [], allowEmpty: true});
            const providerSpy = jest.spyOn(provider, 'handlePretextChanged');

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[provider]}
                />,
            );

            await waitFor(() => {
                expect(providerSpy).toHaveBeenCalledWith('', expect.any(Function));
            });
        });

        test('should clear suggestions when the parent clears the value', async () => {
            const provider = new FixedProvider({trigger: '@', terms: ['@apple']});

            function ClearableWrapper() {
                const [value, setValue] = useState('');

                return (
                    <>
                        <SuggestionBox
                            {...makeBaseProps()}
                            providers={[provider]}
                            value={value}
                            onChange={(e) => setValue((e.target as HTMLInputElement).value)}
                        />
                        <button onClick={() => setValue('')}>{'clear'}</button>
                    </>
                );
            }

            renderWithContext(<ClearableWrapper/>);

            await userEvent.click(getInput());
            await userEvent.keyboard('@a');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            await userEvent.click(screen.getByRole('button', {name: 'clear'}));

            await waitFor(() => {
                expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
            });
        });

        test('should query the providers again when contextId changes', async () => {
            const provider = new FixedProvider({terms: []});
            const providerSpy = jest.spyOn(provider, 'handlePretextChanged');

            const props = makeBaseProps();

            const {rerender} = renderWithContext(
                <TestWrapper
                    {...props}
                    providers={[provider]}
                    contextId='one'
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('test');

            await waitFor(() => {
                expect(providerSpy).toHaveBeenCalledTimes(1);
            });

            rerender(
                <TestWrapper
                    {...props}
                    providers={[provider]}
                    contextId='two'
                />,
            );

            await waitFor(() => {
                expect(providerSpy).toHaveBeenCalledTimes(2);
            });

            expect(providerSpy).toHaveBeenLastCalledWith('test', expect.any(Function));
        });
    });

    describe('suggestion list alignment', () => {
        test('should align the list with the caret for a trigger character', async () => {
            mockGetSuggestionBoxAlgn.mockReturnValue({lineHeight: 20, pixelsToMoveX: 10, pixelsToMoveY: 35});

            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[new FixedProvider({trigger: '/', terms: ['/away', '/echo']})]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('/');

            await waitFor(() => {
                expect(screen.getByRole('listbox')).toBeVisible();
            });

            expect(screen.getByRole('listbox')).toHaveStyle({transform: 'translate(10px, 35px)'});
        });

        test('should only measure the alignment once while the list stays open', async () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[new FixedProvider({trigger: '/', terms: ['/away', '/echo']})]}
                />,
            );

            await userEvent.click(getInput());
            await userEvent.keyboard('/');

            await waitFor(() => {
                expect(mockGetSuggestionBoxAlgn).toHaveBeenCalledTimes(1);
            });

            await userEvent.keyboard('a');

            await waitFor(() => {
                expect(screen.getByText('Suggestion: /away')).toBeVisible();
            });

            expect(mockGetSuggestionBoxAlgn).toHaveBeenCalledTimes(1);
        });
    });

    describe('imperative API', () => {
        test('should not error when unmounted while focus handling is still pending', async () => {
            const {unmount} = renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[new TestProvider()]}
                    openOnFocus={true}
                />,
            );

            await userEvent.click(getInput());
            unmount();

            // Let the pending focus and debounce timers run against the unmounted component
            await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
        });

        test('getTextbox should return the underlying input', () => {
            const ref = React.createRef<SuggestionBox>();

            renderWithContext(
                <SuggestionBox
                    {...makeBaseProps()}
                    ref={ref}
                />,
            );

            expect(ref.current!.getTextbox()).toBe(getInput());
        });

        test('focus should focus the input and move the caret to the end', () => {
            const ref = React.createRef<SuggestionBox>();

            renderWithContext(
                <SuggestionBox
                    {...makeBaseProps()}
                    value='hello'
                    ref={ref}
                />,
            );

            act(() => {
                ref.current!.focus();
            });

            const input = getInput() as HTMLInputElement;
            expect(input).toHaveFocus();
            expect(input.selectionStart).toBe('hello'.length);
        });

        test('focus should move the caret inside trailing quotes', () => {
            const ref = React.createRef<SuggestionBox>();

            renderWithContext(
                <SuggestionBox
                    {...makeBaseProps()}
                    value='from:""'
                    ref={ref}
                />,
            );

            act(() => {
                ref.current!.focus();
            });

            const input = getInput() as HTMLInputElement;
            expect(input.selectionStart).toBe('from:""'.length - 1);
            expect(input.selectionEnd).toBe('from:""'.length - 1);
        });

        test('blur should remove focus from the input', () => {
            const ref = React.createRef<SuggestionBox>();

            renderWithContext(
                <SuggestionBox
                    {...makeBaseProps()}
                    value='hello'
                    ref={ref}
                />,
            );

            act(() => {
                ref.current!.focus();
            });
            expect(getInput()).toHaveFocus();

            act(() => {
                ref.current!.blur();
            });
            expect(getInput()).not.toHaveFocus();
        });
    });

    describe('prop forwarding', () => {
        test('should forward input props to the input element', () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    id='test-id'
                    className='test-class'
                    disabled={true}
                />,
            );

            const input = getInput();
            expect(input).toHaveAttribute('id', 'test-id');
            expect(input).toHaveClass('test-class');
            expect(input).toBeDisabled();
        });

        test('should not forward props used by SuggestionBox to the input element', () => {
            renderWithContext(
                <TestWrapper
                    {...makeBaseProps()}
                    providers={[new TestProvider()]}
                    contextId='context'
                    completeOnTab={true}
                    requiredCharacters={2}
                    openOnFocus={true}
                    openWhenEmpty={true}
                    replaceAllInputOnSelect={true}
                    forceSuggestionsWhenBlur={true}
                    shouldSearchCompleteText={true}
                    alignWithTextbox={true}
                    renderNoResults={true}
                    containerClass='container-class'
                    onItemSelected={jest.fn()}
                    onSuggestionsReceived={jest.fn()}
                />,
            );

            const internalProps = [
                'providers',
                'onitemselected',
                'completeontab',
                'requiredcharacters',
                'openonfocus',
                'openwhenempty',
                'replaceallinputonselect',
                'contextid',
                'forcesuggestionswhenblur',
                'onsuggestionsreceived',
                'actions',
                'shouldsearchcompletetext',
                'alignwithtextbox',
                'containerclass',
                'listcomponent',
                'listposition',
                'rendernoresults',
            ];

            const attributeNames = getInput().getAttributeNames();
            expect(attributeNames.filter((name) => internalProps.includes(name))).toEqual([]);
        });
    });

    describe('findOverlap', () => {
        test.each([
            ['', 'blue', ''],
            ['red', '', ''],
            ['red', 'blue', ''],
            ['red', 'dog', 'd'],
            ['red', 'education', 'ed'],
            ['red', 'reduce', 'red'],
            ['black', 'ack', 'ack'],
        ])('findOverlap(%p, %p) should be %p', (a, b, expected) => {
            expect(SuggestionBox.findOverlap(a, b)).toBe(expected);
        });
    });
});
