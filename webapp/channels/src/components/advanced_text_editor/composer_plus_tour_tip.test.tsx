// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {savePreferences} from 'mattermost-redux/actions/preferences';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ComposerPlusTourTip, {COMPOSER_PLUS_TOUR_TIP_PREFERENCE} from './composer_plus_tour_tip';

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));

describe('ComposerPlusTourTip', () => {
    it('centers the pulsating dot on the top-right corner of the plus button', () => {
        renderWithContext(<ComposerPlusTourTip formattingBarOpen={false}/>);

        const dot = document.getElementById('tipButton');
        expect(dot).toHaveAttribute('data-pulsating-dot-placement', 'top-end');
        expect(dot).toHaveStyle({transform: 'translate(6px, -6px)'});
    });

    it('says emoji and priority are in the formatting bar when that bar is open', async () => {
        renderWithContext(
            <>
                <button id='agentComposerMenuButton'>{'Message options'}</button>
                <ComposerPlusTourTip formattingBarOpen={true}/>
            </>,
        );

        await userEvent.click(document.getElementById('tipButton')!);

        expect(screen.getByText('Attach files from this button. Emoji and message priority are in the formatting bar. Skills and AI rewrite show up here when they are available.')).toBeInTheDocument();
    });

    it('saves that the tip was seen when it is dismissed', async () => {
        renderWithContext(
            <>
                <button id='agentComposerMenuButton'>{'Message options'}</button>
                <ComposerPlusTourTip formattingBarOpen={false}/>
            </>,
            {
                entities: {
                    users: {
                        currentUserId: 'user-id',
                    },
                },
            },
        );

        await userEvent.click(document.getElementById('tipButton')!);
        await userEvent.click(screen.getByRole('button', {name: 'Got it'}));

        expect(savePreferences).toHaveBeenCalledWith('user-id', [{
            user_id: 'user-id',
            category: COMPOSER_PLUS_TOUR_TIP_PREFERENCE,
            name: 'user-id',
            value: '1',
        }]);
    });
});
