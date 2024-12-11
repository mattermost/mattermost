// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import SuggestionBox from './suggestion_box';

import type {ResultsCallback} from '../provider';
import Provider from '../provider';
import SuggestionList from '../suggestion_list';

function TestWrapper(props: React.ComponentPropsWithoutRef<typeof SuggestionBox>) {
    // eslint-disable-next-line react/prop-types
    const [value, setValue] = useState(props.value);

    const handleChange = useCallback((e) => setValue(e.target.value), []);

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
        userEvent.click(screen.getByPlaceholderText('test input'));
        await userEvent.keyboard('test');

        await waitFor(() => {
            // Note that debouncing causes the provider to only be called once when the user stops typing
            expect(providerSpy).toHaveBeenCalledTimes(1);
        });

        expect(screen.queryByRole('listbox')).toBeVisible();

        expect(screen.queryByRole('listbox')).toBeVisible();
        expect(screen.getByText('Suggestion: testtest')).toBeVisible();

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
        userEvent.click(screen.getByPlaceholderText('test input'));
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
        userEvent.click(screen.getByPlaceholderText('test input'));
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

        userEvent.click(screen.getByPlaceholderText('test input'));
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
            expect(onSuggestionsReceived).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByPlaceholderText('test input')).toHaveValue('@use@use This is important');

        // Wait for the second set of results has been received to ensure the contents of the textbox aren't lost
        await new Promise((resolve) => setTimeout(resolve, 20));

        // expect(onSuggestionsReceived).toHaveBeenCalledTimes(1);
        expect(screen.getByPlaceholderText('test input')).toHaveValue('@use@use This is important');
    });
});
