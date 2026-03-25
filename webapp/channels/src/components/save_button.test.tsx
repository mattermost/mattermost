// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SaveButton from 'components/save_button';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/SaveButton', () => {
    const baseProps = {
        saving: false,
    };

    test('should match snapshot, on defaultMessage', () => {
        const {rerender, container} = renderWithContext(<SaveButton {...baseProps}/>);

        expect(container).toMatchSnapshot();
        expect(screen.getByRole('button')).not.toBeDisabled();

        rerender(
            <SaveButton
                {...baseProps}
                defaultMessage='Go'
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on savingMessage', () => {
        const props = {...baseProps, saving: true, disabled: true};
        const {rerender, container} = renderWithContext(<SaveButton {...props}/>);

        expect(container).toMatchSnapshot();
        expect(screen.getByRole('button')).toBeDisabled();

        rerender(
            <SaveButton
                {...props}
                savingMessage='Saving Config...'
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, extraClasses', () => {
        const props = {...baseProps, extraClasses: 'some-class'};
        const {container} = renderWithContext(<SaveButton {...props}/>);

        expect(container).toMatchSnapshot();
    });
});
