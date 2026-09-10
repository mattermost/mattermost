// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from '../page_all_property_field_options';
import type {GraphFieldRef} from '../page_all_property_field_options';

import GraphValueSummary from './graph_value_summary';
import {clearGraphOptionNameCache, commitGraphOptionNames} from './use_graph_option_names';

jest.mock('../page_all_property_field_options', () => ({
    ...jest.requireActual('../page_all_property_field_options'),
    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

const opt = (id: string, name: string, parents: string[] = []): PropertyFieldOption => ({
    id, name, parents, create_at: 1,
});

const fieldOf = (overrides: GraphFieldRef['attrs'] = {}): GraphFieldRef => ({
    id: 'field1',
    object_type: 'user',
    type: 'graph',
    attrs: overrides,
});

const renderSummary = (
    props: Partial<React.ComponentProps<typeof GraphValueSummary>> & {mode: 'confirm' | 'describe'; ids: readonly string[]},
    flagOn = true,
) => {
    return renderWithContext(
        <div data-testid='summary'>
            <GraphValueSummary
                field={fieldOf({options_omitted: true})}
                {...props}
            />
        </div>,
        {entities: {general: {config: {FeatureFlagPropertyFieldGraph: flagOn ? 'true' : 'false'}}}},
    );
};

describe('GraphValueSummary', () => {
    beforeEach(() => {
        clearPropertyFieldOptionWalks();
        clearGraphOptionNameCache();
        mockPageAll.mockImplementation(() => {
            throw new Error('pageAllAccessControlFieldOptions called without an explicit mock for this test');
        });
    });

    test('confirm: unavailable copy when the cache was never committed', () => {
        renderSummary({mode: 'confirm', ids: ['opt-1']});

        expect(screen.getByTestId('summary')).toHaveTextContent('Value unavailable');
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('confirm: raw id after a successful empty commit', () => {
        commitGraphOptionNames('field1', {});
        renderSummary({mode: 'confirm', ids: ['ghost-1']});

        expect(screen.getByTestId('summary')).toHaveTextContent('ghost-1');
        expect(screen.getByTestId('summary')).not.toHaveTextContent('Value unavailable');
    });

    test('confirm: comma-joined names', () => {
        commitGraphOptionNames('field1', {a: 'Alpha', b: 'Beta'});
        renderSummary({
            field: fieldOf({options: [opt('a', 'Alpha'), opt('b', 'Beta')]}),
            mode: 'confirm',
            ids: ['a', 'b'],
        });

        expect(screen.getByTestId('summary')).toHaveTextContent('Alpha, Beta');
        expect(screen.getByTestId('summary')).not.toHaveTextContent('and');
    });

    test('describe: FormattedList when every id is named inline', () => {
        renderSummary({
            field: fieldOf({options: [opt('a', 'Alpha'), opt('b', 'Beta')]}),
            mode: 'describe',
            ids: ['a', 'b'],
        });

        expect(screen.getByTestId('summary')).toHaveTextContent('Alpha');
        expect(screen.getByTestId('summary')).toHaveTextContent('Beta');
        expect(screen.getByTestId('summary')).not.toHaveTextContent('values selected');
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('describe: count when any id is unnamed', () => {
        renderSummary({
            field: fieldOf({options: [opt('a', 'Alpha')]}),
            mode: 'describe',
            ids: ['a', 'ghost'],
        });

        expect(screen.getByText('2 values selected')).toBeInTheDocument();
        expect(screen.getByTestId('summary')).not.toHaveTextContent('Alpha');
        expect(screen.getByTestId('summary')).not.toHaveTextContent('ghost');
    });

    test('describe: count, not unavailable, when didResolve is false and options are omitted', () => {
        renderSummary({
            field: fieldOf({options_omitted: true}),
            mode: 'describe',
            ids: ['opt1', 'opt2'],
        });

        expect(screen.getByText('2 values selected')).toBeInTheDocument();
        expect(screen.getByTestId('summary')).not.toHaveTextContent('Value unavailable');
        expect(mockPageAll).not.toHaveBeenCalled();
    });

    test('describe: names after commit, without a second walk', () => {
        commitGraphOptionNames('field1', {opt1: 'Option 1', opt2: 'Option 2'});
        renderSummary({
            field: fieldOf({options_omitted: true}),
            mode: 'describe',
            ids: ['opt1', 'opt2'],
        });

        expect(screen.getByTestId('summary')).toHaveTextContent('Option 1');
        expect(screen.getByTestId('summary')).toHaveTextContent('Option 2');
        expect(screen.getByTestId('summary')).not.toHaveTextContent('values selected');
        expect(mockPageAll).not.toHaveBeenCalled();
    });
});
