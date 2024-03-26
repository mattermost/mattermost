// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import {
    act,
    fireEvent,
    renderWithContext,
    screen,
} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GatherIntentProps} from './gather_intent';
import {GatherIntent} from './gather_intent';
import type {GatherIntentModalProps} from './gather_intent_modal';

const DummyModal = ({onClose, onSave}: GatherIntentModalProps) => {
    return (
        <>
            <button
                id='closeIcon'
                className='icon icon-close'
                aria-label='Close'
                title='Close'
                onClick={onClose}
            />
            <p>{'Body'}</p>
            <button
                onClick={() => {
                    onSave({ach: true, other: false, wire: true});
                }}
                type='button'
            >
                {'Test'}
            </button>
        </>
    );
};

describe('components/gather_intent/gather_intent.tsx', () => {
    const gatherIntentText = 'gatherIntentText';
    const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');

    const initialState = {
        entities: {
            cloud: {
                customer: TestHelper.getCloudCustomerMock(),
            },
        },
    };

    const baseProps: GatherIntentProps = {
        modalComponent: DummyModal as any,
        gatherIntentText,
        typeGatherIntent: 'monthlySubscription',
    };

    it('should display modal if the user click on the modal opener', () => {
        renderWithContext(
            <GatherIntent {...baseProps}/>,
            initialState,
        );

        fireEvent.click(screen.getByText(gatherIntentText));

        expect(screen.getByText('Body')).toBeInTheDocument();
    });

    it('should display the modal opener after close the modal', () => {
        renderWithContext(
            <GatherIntent {...baseProps}/>,
            initialState,
        );

        fireEvent.click(screen.getByText(gatherIntentText));
        fireEvent.click(screen.getByLabelText('Close'));

        expect(screen.queryByText('Body')).not.toBeInTheDocument();
    });

    it('should render the submitted modal after save the configuration', async () => {
        useDispatchMock.mockReturnValue(jest.fn().mockImplementation(() => new Promise((resolve) => {
            resolve({});
        })));
        renderWithContext(
            <GatherIntent {...baseProps}/>,
            initialState,
        );

        fireEvent.click(screen.getByText(gatherIntentText));

        await act(async () => {
            fireEvent.click(screen.getByText('Test'));
        });

        expect(screen.queryByText('Thanks for sharing feedback!')).toBeInTheDocument();
    });

    it('should render the submitted modal after save the configuration and reopening the modal', async () => {
        useDispatchMock.mockReturnValue(jest.fn().mockImplementation(() => new Promise((resolve) => {
            resolve({});
        })));
        renderWithContext(
            <GatherIntent {...baseProps}/>,
            initialState,
        );

        fireEvent.click(screen.getByText(gatherIntentText));

        await act(async () => {
            fireEvent.click(screen.getByText('Test'));
        });

        fireEvent.click(screen.getByText('Done'));
        fireEvent.click(screen.getByText(gatherIntentText));

        expect(screen.queryByText('Thanks for sharing feedback!')).toBeInTheDocument();
    });

    it('should render the submitted modal when the user has a feedback recorded', async () => {
        useDispatchMock.mockReturnValue(jest.fn().mockImplementation(() => new Promise((resolve) => {
            resolve({});
        })));
        const newState = JSON.parse(JSON.stringify(initialState));
        newState.entities.cloud.customer = {
            ...newState.entities.cloud.customer,
            monthly_subscription_alt_payment_method: 'Dummy feedback',
        };

        renderWithContext(
            <GatherIntent {...baseProps}/>,
            newState,
        );

        fireEvent.click(screen.getByText(gatherIntentText));

        expect(screen.queryByText('Thanks for sharing feedback!')).toBeInTheDocument();
    });
});
