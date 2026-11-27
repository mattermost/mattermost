// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import {SuggestionContainer, type SuggestionProps} from './suggestion';
import SuggestionList, {type Props} from './suggestion_list';

const TestSuggestion = React.forwardRef<HTMLLIElement, SuggestionProps<string>>((props, ref) => {
    return (
        <SuggestionContainer
            ref={ref}
            {...props}
        >
            {props.term}
        </SuggestionContainer>
    );
});
TestSuggestion.displayName = 'TestSuggestion';

describe('components/suggestion/SuggestionList', () => {
    const inputRef = React.createRef<HTMLDivElement>();

    beforeEach(() => {
        const input = document.createElement('div');
        Object.defineProperty(input, 'clientHeight', {value: 40});
        Object.defineProperty(inputRef, 'current', {value: input, writable: true});
        Object.defineProperty(window, 'innerHeight', {value: 1000, configurable: true, writable: true});
    });

    function renderSuggestionList(maxHeight?: number) {
        const props: Props = {
            inputRef,
            open: true,
            position: 'bottom',
            onCompleteWord: jest.fn(() => true),
            onItemHover: jest.fn(),
            pretext: '',
            cleared: false,
            results: {
                matchedPretext: '',
                terms: ['term'],
                items: ['term'],
                components: [TestSuggestion],
            },
            selection: 'term',
            maxHeight,
        };

        return renderWithContext(<SuggestionList {...props}/>);
    }

    test('uses the default maximum height', () => {
        renderSuggestionList();

        expect(document.querySelector('#suggestionList')).toHaveStyle(`max-height: ${Constants.SUGGESTION_LIST_MAXHEIGHT}px`);
    });

    test('uses a provided maximum height', () => {
        renderSuggestionList(592);

        expect(document.querySelector('#suggestionList')).toHaveStyle('max-height: 592px');
    });

    test('limits a provided maximum height to the available viewport space', () => {
        Object.defineProperty(window, 'innerHeight', {value: 500, configurable: true, writable: true});

        renderSuggestionList(592);

        expect(document.querySelector('#suggestionList')).toHaveStyle('max-height: 290px');
    });
});
