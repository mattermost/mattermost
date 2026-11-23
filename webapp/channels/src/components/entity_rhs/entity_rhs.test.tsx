// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EntityRhs from './entity_rhs';

const mockCloseEntity = jest.fn(() => ({type: 'MOCK_CLOSE_ENTITY'}));

jest.mock('actions/views/rhs', () => ({
    closeEntity: (...args: unknown[]) => mockCloseEntity(...args),
}));

jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getEntityCard: jest.fn(() => Promise.resolve({
            type_id: 'com.mattermost.cyberlens:cve',
            value: 'CVE-2021-44228',
            title: 'Log4Shell',
            summary: 'Critical remote code execution',
            rows: [{label: 'Severity', value: 'Critical'}],
        })),
    },
}));

describe('EntityRhs', () => {
    const entity = {
        typeId: 'com.mattermost.cyberlens:cve',
        value: 'CVE-2021-44228',
        label: 'CVE',
        postId: 'post1',
        occurrence: '0:14',
    };

    const baseState = {
        entities: {
            posts: {
                posts: {
                    post1: TestHelper.getPostMock({id: 'post1', root_id: 'root1', channel_id: 'channel1'}),
                    root1: TestHelper.getPostMock({id: 'root1', channel_id: 'channel1'}),
                },
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: TestHelper.getUserMock({id: 'user1'})},
            },
            general: {config: {}},
            preferences: {myPreferences: {}},
            channels: {currentChannelId: 'channel1'},
            teams: {currentTeamId: 'team1'},
        },
        views: {
            rhs: {
                rhsState: 'entity',
                selectedEntity: entity,
                previousSelectedPostId: 'post1',
                previousRhsStates: ['search'],
            },
        },
    };

    beforeEach(() => {
        mockCloseEntity.mockClear();
    });

    it('calls closeEntity when X is clicked so the covered thread can be restored', async () => {
        renderWithContext(<EntityRhs/>, baseState as any);

        await screen.findByTestId('entity-rhs');
        await userEvent.click(screen.getByLabelText('Close'));

        expect(mockCloseEntity).toHaveBeenCalled();
    });

    it('calls closeEntity when root Back is clicked', async () => {
        renderWithContext(<EntityRhs/>, baseState as any);

        await screen.findByTestId('entity-rhs');
        await userEvent.click(screen.getByLabelText('Back'));

        expect(mockCloseEntity).toHaveBeenCalled();
    });
});
