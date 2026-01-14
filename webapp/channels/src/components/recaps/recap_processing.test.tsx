// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Recap} from '@mattermost/types/recaps';
import {RecapStatus} from '@mattermost/types/recaps';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RecapProcessing from './recap_processing';

describe('RecapProcessing', () => {
    const mockRecap: Recap = {
        id: 'recap1',
        title: 'Daily Standup Recap',
        user_id: 'user1',
        bot_id: 'bot1',
        status: RecapStatus.PROCESSING,
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        read_at: 0,
        channels: [],
        total_message_count: 0,
    };

    test('should render recap title', () => {
        renderWithContext(<RecapProcessing recap={mockRecap}/>);

        expect(screen.getByText('Daily Standup Recap')).toBeInTheDocument();
    });

    test('should render processing subtitle message', () => {
        renderWithContext(<RecapProcessing recap={mockRecap}/>);

        expect(screen.getByText("Recap created. You'll receive a summary shortly")).toBeInTheDocument();
    });

    test('should render processing message', () => {
        renderWithContext(<RecapProcessing recap={mockRecap}/>);

        expect(screen.getByText("We're working on your recap. Check back shortly")).toBeInTheDocument();
    });

    test('should render spinner', () => {
        const {container} = renderWithContext(<RecapProcessing recap={mockRecap}/>);

        expect(container.querySelector('.spinner-large')).toBeInTheDocument();
    });

    test('should have correct CSS classes', () => {
        const {container} = renderWithContext(<RecapProcessing recap={mockRecap}/>);

        expect(container.querySelector('.recap-processing')).toBeInTheDocument();
        expect(container.querySelector('.recap-processing-header')).toBeInTheDocument();
        expect(container.querySelector('.recap-processing-content')).toBeInTheDocument();
        expect(container.querySelector('.recap-processing-spinner')).toBeInTheDocument();
    });
});

