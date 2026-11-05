// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {act, renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {ZIndex} from 'utils/constants';

import {AttributeRankCombobox} from './attribute_rank_combobox';
import type {AttributeRankComboboxProps} from './attribute_rank_combobox';

const RANKS: PropertyFieldOption[] = [
    {id: 'low', name: 'Low', rank: 1},
    {id: 'top', name: 'Top', rank: 3},
    {id: 'mid', name: 'Mid', rank: 2, color: '#c8102e'},
    {id: 'zero', name: 'Zero', rank: 0},
    {id: 'odd', name: 'Odd'},
];

const TEST_ID = 'rank';
const SWATCH = 'attribute-option-swatch';
const PLACEHOLDER = 'attribute-option-visual-placeholder';
const BADGE = 'rank-badge';

type HarnessProps = Partial<Pick<AttributeRankComboboxProps, 'required' | 'zIndex'>> & {
    initialValue?: string | string[];
    onChange?: (value: string) => void;
};

function RankHarness({initialValue = '', onChange, ...extra}: HarnessProps) {
    const [value, setValue] = useState(initialValue);
    return (
        <AttributeRankCombobox
            {...extra}
            id='rank-input'
            testId={TEST_ID}
            label='Level'
            options={RANKS}
            value={value}
            onChange={(next) => {
                onChange?.(next);
                setValue(next);
            }}
        />
    );
}

function FormHarness({submitOnEnter, onSubmit}: {submitOnEnter?: boolean; onSubmit: () => void}) {
    const [value, setValue] = useState('top');
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
            }}
        >
            <AttributeRankCombobox
                testId={TEST_ID}
                label='Level'
                options={RANKS}
                value={value}
                submitOnEnter={submitOnEnter}
                onChange={setValue}
            />
            <button type='submit'>{'Save'}</button>
        </form>
    );
}

const getInput = () => screen.getByRole('combobox', {name: 'Level'});
const getRow = (id: string) => screen.getByTestId(`${TEST_ID}-option-${id}`);
const withinRow = (id: string) => within(getRow(id));
const openMenu = () => userEvent.click(getInput());

describe('AttributeRankCombobox', () => {
    test('lists options highest rank first, rank 0 before unranked', async () => {
        renderWithContext(<RankHarness/>);

        await openMenu();

        expect(screen.getAllByRole('option').map((o) => o.id)).toEqual([
            'rank-input-listbox-option-top',
            'rank-input-listbox-option-mid',
            'rank-input-listbox-option-low',
            'rank-input-listbox-option-zero',
            'rank-input-listbox-option-odd',
        ]);
    });

    test('shows the rank badge for an uncoloured ranked option', async () => {
        renderWithContext(<RankHarness/>);

        await openMenu();

        expect(withinRow('top').getByTestId(BADGE)).toHaveTextContent('3');
        expect(withinRow('top').queryByTestId(SWATCH)).not.toBeInTheDocument();
        expect(withinRow('low').getByTestId(BADGE)).toHaveTextContent('1');
    });

    test('shows the colour swatch instead of the badge for a coloured option', async () => {
        renderWithContext(<RankHarness/>);

        await openMenu();

        expect(withinRow('mid').getByTestId(SWATCH)).toHaveStyle({backgroundColor: 'rgb(200, 16, 46)'});
        expect(withinRow('mid').queryByTestId(BADGE)).not.toBeInTheDocument();
    });

    test('keeps the visual slot for an unranked option without a badge or rank text', async () => {
        renderWithContext(<RankHarness/>);

        await openMenu();

        expect(withinRow('odd').getByTestId(PLACEHOLDER)).toBeInTheDocument();
        expect(withinRow('odd').queryByTestId(BADGE)).not.toBeInTheDocument();
        expect(withinRow('odd').queryByText(/Rank/)).not.toBeInTheDocument();
        expect(getRow('odd')).toHaveAccessibleName('Odd');
    });

    test('treats rank 0 as ranked: badge 0', async () => {
        renderWithContext(<RankHarness/>);

        await openMenu();

        expect(withinRow('zero').getByTestId(BADGE)).toHaveTextContent('0');
    });

    test('renders no secondary "Rank n" text under any option', async () => {
        renderWithContext(<RankHarness/>);

        await openMenu();

        for (const option of RANKS) {
            expect(getRow(option.id)).not.toHaveTextContent(/Rank/);
        }
        expect(screen.getByRole('option', {name: 'Mid'})).toBeInTheDocument();
    });

    test.each([
        {value: 'top', expectedBadge: '3', expectedSwatch: false},
        {value: 'zero', expectedBadge: '0', expectedSwatch: false},
        {value: 'mid', expectedBadge: null, expectedSwatch: true},
        {value: 'odd', expectedBadge: null, expectedSwatch: false},
        {value: '', expectedBadge: null, expectedSwatch: false},
        {value: 'ghost', expectedBadge: null, expectedSwatch: false},
    ])('closed field for value "$value" shows badge $expectedBadge, swatch $expectedSwatch', ({value, expectedBadge, expectedSwatch}) => {
        const {container} = renderWithContext(<RankHarness initialValue={value}/>);

        expect(within(container).queryByTestId(BADGE)?.textContent ?? null).toBe(expectedBadge);
        expect(within(container).queryByTestId(SWATCH) !== null).toBe(expectedSwatch);
    });

    test('emits the picked id, and an empty string on clear', async () => {
        const onChange = jest.fn();
        renderWithContext(<RankHarness onChange={onChange}/>);

        await openMenu();
        await userEvent.click(screen.getByRole('option', {name: 'Low'}));

        expect(onChange).toHaveBeenLastCalledWith('low');
        expect(getInput()).toHaveValue('Low');

        await userEvent.click(screen.getByTestId(`${TEST_ID}-clear`));

        expect(onChange).toHaveBeenLastCalledWith('');
        expect(getInput()).toHaveValue('');
    });

    test('shows the first id of a list value and never renders chips', () => {
        renderWithContext(<RankHarness initialValue={['top', 'low']}/>);

        expect(getInput()).toHaveValue('Top');
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    test('forwards id, test id and required to the input', () => {
        const {unmount} = renderWithContext(<RankHarness required={true}/>);

        expect(getInput()).toHaveAttribute('id', 'rank-input');
        expect(getInput()).toHaveAttribute('data-testid', TEST_ID);
        expect(getInput()).toHaveAttribute('aria-required', 'true');
        unmount();

        renderWithContext(<RankHarness/>);

        expect(getInput()).not.toHaveAttribute('aria-required');
    });

    test('portals the menu at the given z-index', async () => {
        renderWithContext(<RankHarness zIndex={ZIndex.MENU}/>);

        await openMenu();

        let layer: HTMLElement | null = screen.getByRole('listbox');
        while (layer && !layer.style.zIndex) {
            layer = layer.parentElement;
        }
        expect(layer?.style.zIndex).toBe('1100');
    });

    test.each([
        {submitOnEnter: undefined, submits: 1},
        {submitOnEnter: false, submits: 0},
    ])('Enter on a closed field submits the form $submits time(s) with submitOnEnter=$submitOnEnter', async ({submitOnEnter, submits}) => {
        const user = userEvent.setup();
        const onSubmit = jest.fn();
        renderWithContext(
            <FormHarness
                submitOnEnter={submitOnEnter}
                onSubmit={onSubmit}
            />,
        );
        const input = getInput();

        act(() => input.focus());
        expect(input).toHaveAttribute('aria-expanded', 'false');
        await user.keyboard('{Enter}');

        expect(onSubmit).toHaveBeenCalledTimes(submits);
    });

    test('ignores multiple passed past the types and stays single-select', () => {
        const {container} = renderWithContext(
            <AttributeRankCombobox
                testId={TEST_ID}
                label='Level'
                options={RANKS}
                value='top'
                onChange={jest.fn()}

                // @ts-expect-error multiple is not part of the rank combobox props
                multiple={true}
            />,
        );

        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
        expect(getInput()).toHaveValue('Top');
        expect(within(container).getByTestId(BADGE)).toHaveTextContent('3');
    });

    test('ignores decorateOption passed past the types and keeps the rank decoration', () => {
        const {container} = renderWithContext(
            <AttributeRankCombobox
                testId={TEST_ID}
                label='Level'
                options={RANKS}
                value='top'
                onChange={jest.fn()}

                // @ts-expect-error decorateOption is not part of the rank combobox props
                decorateOption={() => ({})}
            />,
        );

        expect(within(container).getByTestId(BADGE)).toHaveTextContent('3');
    });
});
