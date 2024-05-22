// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, act, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import {sendPasswordResetEmail} from 'mattermost-redux/actions/users';

import {withIntl} from 'tests/helpers/intl-test-helper';

import PasswordResetSendLink from './password_reset_send_link';

const mockDispatch = jest.fn().mockResolvedValue(Promise.resolve({data: true}));
let mockState: any;

jest.mock('mattermost-redux/actions/users', () => ({
    sendPasswordResetEmail: jest.fn().mockResolvedValue(Promise.resolve({data: true})),
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom') as typeof import('react-router-dom'),
    useLocation: () => ({
        search: '',
    }),
    useHistory: () => ({
        push: jest.fn(),
    }),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/PasswordResetSendLink', () => {
    mockState = {
        entities: {
            general: {
                config: {
                    EnableCustomBrand: 'false',
                },
            },
        },
    };

    it('should match snapshot', () => {
        const wrapper = render(withIntl(<PasswordResetSendLink/>));
        expect(wrapper.asFragment()).toMatchSnapshot();
    });

    it('should calls sendPasswordResetEmail() action on submit', async () => {
        const wrapper = render(withIntl(
            <MemoryRouter>
                <PasswordResetSendLink/>
            </MemoryRouter>,
        ));

        act(() => {
            fireEvent.change(wrapper.getByTestId('email'), {target: {value: 'test@example.com'}});
        });

        await act(async () => {
            fireEvent.click(wrapper.getByRole('button'));
            await waitFor(() => expect(sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com'));
        });

        expect(wrapper.getByText('test@example.com')).toBeInTheDocument();
        expect(wrapper.getByText('If the account exists, a password reset email will be sent to:')).toBeInTheDocument();
    });
});
