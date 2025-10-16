// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SuggestionBox from './suggestion_box';

import AtMentionProvider from '../at_mention_provider';
import type {ResultsCallback} from '../provider';
import Provider from '../provider';
import SuggestionList from '../suggestion_list';

jest.mock('utils/utils', () => ({
    ...jest.requireActual('utils/utils'),
    getSuggestionBoxAlgn() {
        return {
            pixelsToMoveX: 0,
            pixelsToMoveY: 0,
        };
    },
}));

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

const TestSuggestion = React.forwardRef<HTMLDivElement, {term: string}>((props, ref) => {
    return <div ref={ref}>{'Suggestion: ' + props.term}</div>;
});

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
        await userEvent.click(screen.getByPlaceholderText('test input'));
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

        expect(screen.queryByRole('listbox')).toBeVisible();
        expect(screen.getByText('Suggestion: testwordstestwords')).toBeVisible();

        // Clearing the textbox hides all suggestions
        await userEvent.clear(screen.getByPlaceholderText('test input'));

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
        await userEvent.click(screen.getByPlaceholderText('test input'));
        await userEvent.keyboard('test');

        await waitFor(() => {
            expect(screen.getByRole('listbox')).toBeVisible();
        });

        // Pressing escape hides all suggestions
        await userEvent.keyboard('{escape}');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
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
        await userEvent.click(screen.getByPlaceholderText('test input'));
        await userEvent.keyboard('test');

        await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBeVisible();
            expect(screen.getByText('Suggestion: testtest')).toBeVisible();
        });

        // Pressing enter should update the textbox value and hide the suggestion list
        await userEvent.keyboard('{enter}');

        await waitFor(() => {
            expect(screen.getByPlaceholderText('test input')).toHaveValue('testtest ');
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

        await userEvent.click(screen.getByPlaceholderText('test input'));
        await userEvent.keyboard('This is important');

        // The provider will send results to the SuggestionBox twice to simulate loading results from the server
        await waitFor(() => {
            expect(onSuggestionsReceived).toHaveBeenCalledTimes(2);
        });

        onSuggestionsReceived.mockClear();

        expect(screen.getByPlaceholderText('test input')).toHaveValue('This is important');
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
            expect(screen.getByPlaceholderText('test input')).toHaveValue('@use@use This is important');
            expect(onSuggestionsReceived).toHaveBeenCalledTimes(1);
        });

        // Wait for the second set of results has been received to ensure the contents of the textbox aren't lost
        await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

        // expect(onSuggestionsReceived).toHaveBeenCalledTimes(1);
        expect(screen.getByPlaceholderText('test input')).toHaveValue('@use@use This is important');
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

        const input = screen.getByPlaceholderText('test input');
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
});
