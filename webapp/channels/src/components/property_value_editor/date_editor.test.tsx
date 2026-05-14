// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import DateEditor from './date_editor';

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'f1',
        group_id: 'g1',
        name: 'Due',
        type: 'date',
        target_id: 'channel-1',
        target_type: 'channel',
        object_type: 'post',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'u1',
        updated_by: 'u1',
        ...overrides,
    };
}

function wrap(ui: React.ReactElement) {
    return <IntlProvider locale='en'>{ui}</IntlProvider>;
}

describe('components/property_value_editor/DateEditor', () => {
    test('renders the calendar for an empty value', () => {
        render(wrap(
            <DateEditor
                field={makeField()}
                value={undefined}
                onChange={jest.fn()}
            />,
        ));

        // The calendar grid is rendered even with no selection.
        expect(screen.getByRole('grid')).toBeInTheDocument();

        // No day should be marked as selected.
        expect(document.querySelector('.rdp-day_selected')).toBeNull();
    });

    test('renders the calendar focused on the selected month when a value is set', () => {
        render(wrap(
            <DateEditor
                field={makeField()}
                value='2026-04-01'
                onChange={jest.fn()}
            />,
        ));

        // Caption shows the month/year of the selected date.
        expect(screen.getByText(/April 2026/i)).toBeInTheDocument();

        // The selected day cell shows day "1".
        const selected = document.querySelector('.rdp-day_selected');
        expect(selected).not.toBeNull();
        expect(selected!.textContent).toBe('1');
    });

    test('exposes the field id on the wrapper element', () => {
        const {container} = render(wrap(
            <DateEditor
                field={makeField()}
                value=''
                onChange={jest.fn()}
            />,
        ));

        const wrapper = container.querySelector('[data-property-field-id="f1"]');
        expect(wrapper).not.toBeNull();
        expect(wrapper!.getAttribute('aria-label')).toBe('Due');
    });

    test('emits the ISO date when a day is picked', () => {
        const onChange = jest.fn();
        render(wrap(
            <DateEditor
                field={makeField()}
                value='2026-04-01'
                onChange={onChange}
            />,
        ));

        // Click day 15 inside the visible (April 2026) month. Day buttons
        // outside the current month carry the rdp-day_outside class — we
        // filter those out.
        const allDay15 = Array.from(document.querySelectorAll('.rdp-day')).
            filter((el) => el.textContent === '15' && !el.classList.contains('rdp-day_outside'));
        expect(allDay15.length).toBe(1);

        fireEvent.click(allDay15[0]);

        expect(onChange).toHaveBeenCalledWith('2026-04-15');
    });
});
