// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SaveButton from 'components/save_button';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/SaveButton', () => {
    const baseProps = {
        saving: false,
    };

    test('should render on defaultMessage', () => {
        const {rerender} = renderWithContext(<SaveButton {...baseProps}/>);
        expect(screen.getByRole('button')).not.toBeDisabled();

        rerender(
            <SaveButton
                {...baseProps}
                defaultMessage='Go'
            />,
        );
    });

    test('should render on savingMessage', () => {
        const props = {...baseProps, saving: true, disabled: true};
        const {rerender} = renderWithContext(<SaveButton {...props}/>);
        expect(screen.getByRole('button')).toBeDisabled();

        rerender(
            <SaveButton
                {...props}
                savingMessage='Saving Config...'
            />,
        );
    });
});
