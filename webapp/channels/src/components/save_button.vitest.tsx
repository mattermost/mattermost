// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SaveButton from 'components/save_button';

import {renderWithIntl, screen} from 'tests/vitest_react_testing_utils';

describe('components/SaveButton', () => {
    const baseProps = {
        saving: false,
    };

    test('should match snapshot, on defaultMessage', () => {
        const {container, rerender} = renderWithIntl(<SaveButton {...baseProps}/>);

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
        const {container, rerender} = renderWithIntl(<SaveButton {...props}/>);

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
        const {container} = renderWithIntl(<SaveButton {...props}/>);

        expect(container).toMatchSnapshot();
    });
});
