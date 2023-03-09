// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Provider} from 'react-redux';
import {act} from 'react-dom/test-utils';

import {shallow} from 'enzyme';

import * as cloudActions from 'actions/cloud';

import GenericModal from 'components/generic_modal';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import RequestBusinessEmailModal from './request_business_email_modal';

jest.useFakeTimers();
jest.mock('lodash/debounce', () => jest.fn((fn) => fn));

describe('components/request_business_email_modal/request_business_email_modal', () => {
    const state = {
        entities: {
            admin: {},
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            cloud: {
                subscription: {id: 'subscriptionID'},
            },
        },
        views: {
            modals: {
                modalState: {
                    request_business_email_modal: {
                        open: 'true',
                    },
                },
            },
        },
    };

    const props = {
        onExited: jest.fn(),
    };

    const store = mockStore(state);

    test('should match snapshot', () => {
        const wrapper = shallow(
            <Provider store={store}>
                <RequestBusinessEmailModal {...props}/>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should show the Start Cloud Trial Button', async () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal {...props}/>
            </Provider>,
        );

        await act(async () => {
            const startTrialBtn = wrapper.find('CloudStartTrialButton');
            expect(startTrialBtn).toHaveLength(1);
        });
    });

    test('should call on close', async () => {
        const mockOnClose = jest.fn();

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal
                    {...props}
                    onClose={mockOnClose}
                />
            </Provider>,
        );

        await act(async () => {
            wrapper.find(GenericModal).props().onExited();
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    test('should call on exited', async () => {
        const mockOnExited = jest.fn();

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal
                    {...props}
                    onExited={mockOnExited}
                />
            </Provider>,
        );

        await act(async () => {
            wrapper.find(GenericModal).props().onExited();
            expect(mockOnExited).toHaveBeenCalled();
        });
    });

    test('should show the Input to enter the valid Business Email', async () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal {...props}/>
            </Provider>,
        );

        await act(async () => {
            expect(wrapper.find('InputBusinessEmail')).toHaveLength(1);
        });
    });

    test('should start with Start Cloud Trial Button disabled', async () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal {...props}/>
            </Provider>,
        );

        await act(async () => {
            const startTrialBtn = wrapper.find('CloudStartTrialButton');
            expect(startTrialBtn.props().disabled).toEqual(true);
        });
    });

    test('should ENABLE the trial button if email is VALID', async () => {
        // mock validation response to TRUE meaning the email is a valid email
        const validateBusinessEmail = () => () => Promise.resolve(true);
        jest.spyOn(cloudActions, 'validateBusinessEmail').mockImplementation(validateBusinessEmail);

        const event = {
            target: {value: 'valid-email@domain.com'},
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal {...props}/>
            </Provider>,
        );

        await act(async () => {
            const inputBusinessEmail = wrapper.find('InputBusinessEmail');
            const input = inputBusinessEmail.find('input');
            input.find('input').at(0).simulate('change', event);
        });

        act(() => {
            wrapper.update();
            const startTrialBtn = wrapper.find('CloudStartTrialButton');
            expect(startTrialBtn.props().disabled).toEqual(false);
        });
    });

    test('should show the success custom message if the email is valid', async () => {
        // mock validation response to TRUE meaning the email is a valid email
        const validateBusinessEmail = () => () => Promise.resolve(true);

        jest.spyOn(cloudActions, 'validateBusinessEmail').mockImplementation(validateBusinessEmail);

        const event = {
            target: {value: 'valid-email@domain.com'},
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal {...props}/>
            </Provider>,
        );

        await act(async () => {
            const inputBusinessEmail = wrapper.find('InputBusinessEmail');
            const input = inputBusinessEmail.find('input');
            input.find('input').at(0).simulate('change', event);
        });

        act(() => {
            wrapper.update();
            const customMessageElement = wrapper.find('.Input___customMessage.Input___success');
            expect(customMessageElement.length).toBe(1);
        });
    });

    test('should DISABLE the trial button if email is INVALID', async () => {
        // mock validation response to FALSE meaning the email is an invalid email
        const validateBusinessEmail = () => () => Promise.resolve(false);
        jest.spyOn(cloudActions, 'validateBusinessEmail').mockImplementation(validateBusinessEmail);

        const event = {
            target: {value: 'INvalid-email@domain.com'},
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal {...props}/>
            </Provider>,
        );

        await act(async () => {
            const inputBusinessEmail = wrapper.find('InputBusinessEmail');
            const input = inputBusinessEmail.find('input');
            input.find('input').at(0).simulate('change', event);
        });

        act(() => {
            wrapper.update();
            const startTrialBtn = wrapper.find('CloudStartTrialButton');
            expect(startTrialBtn.props().disabled).toEqual(true);
        });
    });

    test('should show the error custom message if the email is invalid', async () => {
        // mock validation response to FALSE meaning the email is an invalid email
        const validateBusinessEmail = () => () => Promise.resolve(false);
        jest.spyOn(cloudActions, 'validateBusinessEmail').mockImplementation(validateBusinessEmail);

        const event = {
            target: {value: 'INvalid-email@domain.com'},
        };

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <RequestBusinessEmailModal {...props}/>
            </Provider>,
        );

        await act(async () => {
            const inputBusinessEmail = wrapper.find('InputBusinessEmail');
            const input = inputBusinessEmail.find('input');
            input.find('input').at(0).simulate('change', event);
        });

        act(() => {
            wrapper.update();
            const customMessageElement = wrapper.find('.Input___customMessage.Input___error');
            expect(customMessageElement.length).toBe(1);
        });
    });
});
