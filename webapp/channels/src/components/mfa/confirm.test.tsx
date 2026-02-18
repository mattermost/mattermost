// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {redirectUserToDefaultTeam} from 'actions/global_actions';

import Confirm from 'components/mfa/confirm';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

jest.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: jest.fn(),
}));

describe('components/mfa/components/Confirm', () => {
    const originalAddEventListener = document.body.addEventListener;

    afterAll(() => {
        document.body.addEventListener = originalAddEventListener;
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<Confirm/>);
        expect(container).toMatchSnapshot();
    });

    test('should submit on form submit', async () => {
        renderWithContext(<Confirm/>);

        await userEvent.click(screen.getByRole('button', {name: 'Okay'}));

        expect(redirectUserToDefaultTeam).toHaveBeenCalled();
    });

    test('should submit on enter', () => {
        const map: { [key: string]: any } = {
            keydown: null,
        };
        document.body.addEventListener = jest.fn().mockImplementation((event: string, callback: string) => {
            map[event] = callback;
        });

        renderWithContext(<Confirm/>);

        const event = {
            preventDefault: jest.fn(),
            key: Constants.KeyCodes.ENTER[0],
        };
        map.keydown(event);

        expect(redirectUserToDefaultTeam).toHaveBeenCalled();
    });
});
