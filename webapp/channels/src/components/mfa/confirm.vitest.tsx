// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {redirectUserToDefaultTeam} from 'actions/global_actions';

import Confirm from 'components/mfa/confirm';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';

vi.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: vi.fn(),
}));

describe('components/mfa/components/Confirm', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(<Confirm/>);
        expect(container).toMatchSnapshot();
    });

    test('should submit on form submit', () => {
        renderWithContext(<Confirm/>);

        // The form doesn't have role="form" by default, select it directly
        const form = document.querySelector('form') as HTMLFormElement;
        expect(form).toBeTruthy();
        fireEvent.submit(form);

        expect(redirectUserToDefaultTeam).toHaveBeenCalled();
    });

    test('should submit on enter', () => {
        renderWithContext(<Confirm/>);

        // Simulate keydown event
        fireEvent.keyDown(document.body, {
            key: Constants.KeyCodes.ENTER[0],
            preventDefault: vi.fn(),
        });

        expect(redirectUserToDefaultTeam).toHaveBeenCalled();
    });
});
