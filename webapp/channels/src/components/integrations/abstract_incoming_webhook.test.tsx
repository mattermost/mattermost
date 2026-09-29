// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';
import type {IncomingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {DeepPartial} from '@mattermost/types/utilities';

import AbstractIncomingWebhook from 'components/integrations/abstract_incoming_webhook';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

jest.mock('components/admin_console/content_flagging/user_multiselector/user_multiselector', () => ({
    UserSelector: (props: {id: string; singleSelectInitialValue?: string; singleSelectOnChange?: (id: string) => void}) => (
        <button
            type='button'
            id={props.id}
            data-testid='owner-selector'
            data-value={props.singleSelectInitialValue}
            onClick={() => props.singleSelectOnChange?.('new_owner_id')}
        />
    ),
}));

const initialState: DeepPartial<GlobalState> = {
    entities: {
        channels: {
            currentChannelId: 'current_channel_id',
            channels: {
                current_channel_id: TestHelper.getChannelMock({
                    id: 'current_channel_id',
                    team_id: 'team_id',
                    type: 'O' as ChannelType,
                    name: 'current_channel',
                }),
            },
            myMembers: {
                current_channel_id: TestHelper.getChannelMembershipMock({channel_id: 'current_channel_id'}),
            },
            channelsInTeam: {
                team_id: new Set(['current_channel_id']),
            },
        },
        teams: {
            currentTeamId: 'team_id',
            teams: {
                team_id: TestHelper.getTeamMock({id: 'team_id'}),
            },
            myMembers: {
                team_id: TestHelper.getTeamMembershipMock({roles: 'team_roles'}),
            },
        },
    },
};

describe('components/integrations/AbstractIncomingWebhook', () => {
    const team: Team = TestHelper.getTeamMock({id: 'team_id', name: 'team_name'});
    const header = {id: 'header_id', defaultMessage: 'Header'};
    const footer = {id: 'footer_id', defaultMessage: 'Footer'};
    const loading = {id: 'loading_id', defaultMessage: 'Loading'};

    const initialHook: IncomingWebhook = {
        id: 'test_id',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        last_used: 0,
        user_id: 'test_user_id',
        channel_id: 'current_channel_id',
        team_id: 'team_id',
        display_name: 'testIncomingWebhook',
        description: 'testing',
        username: '',
        icon_url: '',
        channel_locked: false,
    };

    const action = jest.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
            process.nextTick(() => resolve());
        });
    });

    const requiredProps = {
        team,
        header,
        footer,
        loading,
        initialHook,
        enablePostUsernameOverride: false,
        enablePostIconOverride: false,
        serverError: '',
        action,
    };

    beforeEach(() => {
        action.mockClear();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>, initialState as GlobalState);
        expect(container).toMatchSnapshot();
    });

    test('should not render the owner selector when canManageOthersWebhooks is false', () => {
        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>, initialState as GlobalState);
        expect(container.querySelector('#ownerId')).not.toBeInTheDocument();
    });

    test('should render the owner selector when canManageOthersWebhooks is true', () => {
        const props = {...requiredProps, canManageOthersWebhooks: true};
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>, initialState as GlobalState);
        const ownerSelector = container.querySelector('#ownerId');
        expect(ownerSelector).toBeInTheDocument();
        expect(ownerSelector).toHaveAttribute('data-value', 'test_user_id');
    });

    test('should submit the existing owner when it is not changed', async () => {
        const {container} = renderWithContext(<AbstractIncomingWebhook {...requiredProps}/>, initialState as GlobalState);
        await userEvent.click(container.querySelector('#saveWebhook') as HTMLButtonElement);

        expect(action).toHaveBeenCalledTimes(1);
        expect(action).toHaveBeenCalledWith(expect.objectContaining({user_id: 'test_user_id'}));
    });

    test('should submit the newly selected owner', async () => {
        const props = {...requiredProps, canManageOthersWebhooks: true};
        const {container} = renderWithContext(<AbstractIncomingWebhook {...props}/>, initialState as GlobalState);

        await userEvent.click(container.querySelector('[data-testid="owner-selector"]') as HTMLButtonElement);
        await userEvent.click(container.querySelector('#saveWebhook') as HTMLButtonElement);

        expect(action).toHaveBeenCalledTimes(1);
        expect(action).toHaveBeenCalledWith(expect.objectContaining({user_id: 'new_owner_id'}));
    });
});
