// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {Client4} from 'mattermost-redux/client';

import * as rhsActions from 'actions/views/rhs';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import MissingRequiredAttributesNotice from './missing_required_attributes_notice';

jest.mock('mattermost-redux/actions/properties', () => ({
    ...jest.requireActual('mattermost-redux/actions/properties'),
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

const GROUP_ID = 'group1';

function field(id: string): PropertyField {
    return {
        id,
        group_id: GROUP_ID,
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        permission_values: 'admin',
        attrs: {required: true, display_name: id, options: [{id: `opt_${id}`, name: 'One'}]},
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function value(channelId: string, fieldId: string): PropertyValue<unknown> {
    return {
        id: `value_${channelId}_${fieldId}`,
        target_id: channelId,
        target_type: 'channel',
        group_id: GROUP_ID,
        field_id: fieldId,
        value: `opt_${fieldId}`,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function makeState(fields: PropertyField[], {flag = 'true', channelType = 'O'}: {flag?: string; channelType?: string} = {}): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {
                config: {FeatureFlagChannelAttributes: 'true', FeatureFlagChannelAttributesRequired: flag},
                license: {IsLicensed: 'true', SkuShortName: 'advanced'},
            },
            channels: {
                channels: {
                    channel1: {id: 'channel1', team_id: 'team1', type: channelType, delete_at: 0},
                    channel2: {id: 'channel2', team_id: 'team1', type: channelType, delete_at: 0},
                },
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: {id: 'user1', roles: 'system_admin'}},
            },
            properties: {
                groups: {byId: {[GROUP_ID]: {id: GROUP_ID, name: 'access_control'}}, byName: {access_control: {id: GROUP_ID, name: 'access_control'}}},
                fields: {
                    byId: Object.fromEntries(fields.map((f) => [f.id, f])),
                    byObjectType: {channel: {[GROUP_ID]: Object.fromEntries(fields.map((f) => [f.id, f]))}},
                },
                values: {byTargetId: {}, byFieldId: {}},
                loadedValueTargets: {channel1: true, channel2: true},
            },
        },
    } as DeepPartial<GlobalState>;
}

describe('MissingRequiredAttributesNotice', () => {
    let getPropertyValues: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        getPropertyValues = jest.spyOn(Client4, 'getPropertyValues').mockResolvedValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('shows the notice when a required value is missing', () => {
        renderWithContext(<MissingRequiredAttributesNotice channelId='channel1'/>, makeState([field('program')]));

        expect(screen.getByTestId('missingRequiredAttributesNotice')).toHaveAttribute('role', 'status');
        expect(screen.getByText('Channel attribute values are missing')).toBeInTheDocument();
        expect(screen.getByTestId('missingRequiredAttributesNoticeAddValues')).toHaveTextContent('Add values');
    });

    test('shows nothing when no required field is missing a value', () => {
        const state = makeState([field('program')]);
        (state.entities!.properties!.values as {byTargetId: Record<string, unknown>}).byTargetId = {channel1: {program: value('channel1', 'program')}};

        renderWithContext(<MissingRequiredAttributesNotice channelId='channel1'/>, state);

        expect(screen.queryByTestId('missingRequiredAttributesNotice')).not.toBeInTheDocument();
    });

    test('shows nothing while the required flag is off', () => {
        renderWithContext(<MissingRequiredAttributesNotice channelId='channel1'/>, makeState([field('program')], {flag: 'false'}));

        expect(screen.queryByTestId('missingRequiredAttributesNotice')).not.toBeInTheDocument();
    });

    test('shows nothing for a direct message', () => {
        renderWithContext(<MissingRequiredAttributesNotice channelId='channel1'/>, makeState([field('program')], {channelType: 'D'}));

        expect(screen.queryByTestId('missingRequiredAttributesNotice')).not.toBeInTheDocument();
    });

    test('Add values opens the editor for the first missing field', async () => {
        const openEditor = jest.spyOn(rhsActions, 'openChannelAttributeEditor').mockReturnValue(() => ({data: true}));

        renderWithContext(<MissingRequiredAttributesNotice channelId='channel1'/>, makeState([field('zulu'), field('alpha')]));

        await userEvent.click(screen.getByTestId('missingRequiredAttributesNoticeAddValues'));

        expect(openEditor).toHaveBeenCalledWith('channel1', 'alpha');
    });

    test('switching to a second loaded channel fetches neither values nor fields', () => {
        const {rerender} = renderWithContext(<MissingRequiredAttributesNotice channelId='channel1'/>, makeState([field('program')]));
        expect(screen.getByTestId('missingRequiredAttributesNotice')).toBeInTheDocument();

        rerender(<MissingRequiredAttributesNotice channelId='channel2'/>);

        expect(screen.getByTestId('missingRequiredAttributesNotice')).toBeInTheDocument();
        expect(getPropertyValues).not.toHaveBeenCalled();
        expect(fetchPropertyFields).not.toHaveBeenCalled();
    });

    test('a websocket value for the missing field hides the notice', () => {
        const {store} = renderWithContext(<MissingRequiredAttributesNotice channelId='channel1'/>, makeState([field('program')]));
        expect(screen.getByTestId('missingRequiredAttributesNotice')).toBeInTheDocument();

        act(() => {
            store.dispatch({
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [value('channel1', 'program')]},
            });
        });

        expect(screen.queryByTestId('missingRequiredAttributesNotice')).not.toBeInTheDocument();
    });
});
