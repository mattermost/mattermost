// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SchedulePerspectiveToggle from './schedule_perspective_toggle';

describe('SchedulePerspectiveToggle', () => {
    it('renders radiogroup with both options', () => {
        renderWithContext(
            <SchedulePerspectiveToggle
                perspective='theirs'
                recipientFirstName='Sarah'
                onChange={jest.fn()}
            />,
        );

        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'My time'})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: "Sarah's time"})).toHaveAttribute('aria-checked', 'true');
    });

    it('calls onChange when My time is selected', async () => {
        const onChange = jest.fn();

        renderWithContext(
            <SchedulePerspectiveToggle
                perspective='theirs'
                recipientFirstName='Sarah'
                onChange={onChange}
            />,
        );

        await userEvent.click(screen.getByRole('radio', {name: 'My time'}));

        expect(onChange).toHaveBeenCalledWith('mine');
    });
});
