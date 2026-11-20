// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {savePreferences} from 'mattermost-redux/actions/preferences';

import {BURN_ON_READ_TOUR_TIP_PREFERENCE} from 'selectors/burn_on_read';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';

import BurnOnReadTourTip from './burn_on_read_tour_tip';

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));

describe('BurnOnReadTourTip', () => {
    const onTryItOut = jest.fn();

    it('points the tour card at the burn-on-read control', async () => {
        renderWithContext(
            <>
                <button id='burnOnReadButton'>{'Burn-on-read'}</button>
                <BurnOnReadTourTip onTryItOut={onTryItOut}/>
            </>,
        );

        const tour = screen.getByTestId('burn-on-read-tour');
        expect(tour).toHaveAttribute('data-anchor-id', 'burnOnReadButton');
        expect(tour).toHaveAttribute('data-pointer-position', 'bottom-center');
        expect(tour).toHaveStyle({pointerEvents: 'none'});
        expect(screen.queryByText('Burn-on-read messages')).not.toBeInTheDocument();

        await userEvent.click(within(tour).getByRole('button', {name: 'Open tip'}));

        expect(screen.getByText('Burn-on-read messages')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Try it out'})).toHaveStyle({pointerEvents: 'auto'});
    });

    it('enables burn-on-read from Try it out', async () => {
        renderWithContext(
            <>
                <button id='burnOnReadButton'>{'Burn-on-read'}</button>
                <BurnOnReadTourTip onTryItOut={onTryItOut}/>
            </>,
            {
                entities: {
                    users: {
                        currentUserId: 'user-id',
                    },
                },
            },
        );

        await userEvent.click(screen.getByRole('button', {name: 'Open tip'}));
        await userEvent.click(screen.getByRole('button', {name: 'Try it out'}));

        await waitFor(() => {
            expect(onTryItOut).toHaveBeenCalled();
        });
        expect(savePreferences).toHaveBeenCalledWith('user-id', [{
            user_id: 'user-id',
            category: BURN_ON_READ_TOUR_TIP_PREFERENCE,
            name: 'user-id',
            value: '1',
        }]);
    });
});
