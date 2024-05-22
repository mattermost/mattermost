// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, render, act, waitFor} from '@testing-library/react';
import {shallow} from 'enzyme';
import React from 'react';

import {resetUserPassword} from 'mattermost-redux/actions/users';

import {withIntl} from 'tests/helpers/intl-test-helper';

import PasswordResetForm from './password_reset_form';

const mockDispatch = jest.fn().mockResolvedValue(Promise.resolve({data: true}));
const mockLocation = jest.fn();
let mockState: any;

jest.mock('mattermost-redux/actions/users', () => ({
    resetUserPassword: jest.fn().mockResolvedValue(Promise.resolve({data: true})),
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom') as typeof import('react-router-dom'),
    useLocation: () => mockLocation(),
    useHistory: () => ({
        push: jest.fn(),
    }),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/PasswordResetForm', () => {
    mockState = {
        entities: {
            general: {
                config: {
                    SiteName: 'Mattermost',
                },
            },
        },
    };

    it('should match snapshot', () => {
        mockLocation.mockReturnValue({search: '?token='});
        const wrapper = shallow(<PasswordResetForm/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should call the resetUserPassword() action on submit', async () => {
        mockLocation.mockReturnValue({search: '?token=TOKEN'});

        const wrapper = render(withIntl(<PasswordResetForm/>));
        const inputElement = wrapper.getByTestId('resetPasswordInput');

        act(() => {
            fireEvent.change(inputElement, {target: {value: 'PASSWORD'}});
        });

        await act(async () => {
            fireEvent.click(wrapper.getByRole('button'));
            await waitFor(() => expect(resetUserPassword).toHaveBeenCalledWith('TOKEN', 'PASSWORD'));
        });
    });
});
