// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import BoolSetting from './bool_setting';

describe('components/widgets/settings/BoolSetting', () => {
    test('should render component with required props', () => {
        const onChange = jest.fn();
        render(
            <BoolSetting
                id='string.id'
                label='some label'
                value={true}
                placeholder='Text aligned with checkbox'
                onChange={onChange}
            />,
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).toBeChecked();
        expect(checkbox).toHaveAttribute('id', 'string.id');
        expect(screen.getByText('some label')).toBeInTheDocument();
        expect(screen.getByText('Text aligned with checkbox')).toBeInTheDocument();
    });

    test('should call onChange when checkbox is clicked', async () => {
        const onChange = jest.fn();
        render(
            <BoolSetting
                id='string.id'
                label='some label'
                value={false}
                placeholder='Text aligned with checkbox'
                onChange={onChange}
            />,
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();

        await userEvent.click(checkbox);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('string.id', true);
    });
});
