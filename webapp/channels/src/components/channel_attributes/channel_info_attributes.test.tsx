// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ChannelInfoAttributes from './channel_info_attributes';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

const GROUP_ID = 'group1';
const CHANNEL_ID = 'channel1';

type FieldOptions = {
    required?: boolean;
    editable?: boolean;
    actions?: string[];
};

function field(id: string, {required, editable, actions = ['display_label_info']}: FieldOptions = {}): PropertyField {
    return {
        id,
        group_id: GROUP_ID,
        name: id,
        type: 'select',
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        attrs: {
            actions,
            options: [{id: `opt_${id}`, name: id.toUpperCase(), color: '#1e325c'}],
            display_name: id.toUpperCase(),
            ...(required === undefined ? {} : {required}),
            ...(editable === undefined ? {} : {editable}),
        },
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function value(fieldId: string, raw: unknown): PropertyValue<unknown> {
    return {
        id: `value_${fieldId}`,
        target_id: CHANNEL_ID,
        target_type: 'channel',
        group_id: GROUP_ID,
        field_id: fieldId,
        value: raw,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function makeState(fields: PropertyField[], values: Array<PropertyValue<unknown>>, flag = 'true'): DeepPartial<GlobalState> {
    const byTargetId: Record<string, Record<string, PropertyValue<unknown>>> = {};
    for (const v of values) {
        byTargetId[v.target_id] = {...byTargetId[v.target_id], [v.field_id]: v};
    }

    return {
        entities: {
            general: {
                config: {FeatureFlagChannelAttributes: flag},
                license: {IsLicensed: 'true', SkuShortName: 'enterprise'},
            },
            properties: {
                groups: {byId: {[GROUP_ID]: {id: GROUP_ID, name: 'access_control'}}, byName: {access_control: {id: GROUP_ID, name: 'access_control'}}},
                fields: {
                    byId: Object.fromEntries(fields.map((f) => [f.id, f])),
                    byObjectType: {channel: {[GROUP_ID]: Object.fromEntries(fields.map((f) => [f.id, f]))}},
                },
                values: {byTargetId, byFieldId: {}},
            },
        },
    } as DeepPartial<GlobalState>;
}

describe('ChannelInfoAttributes', () => {
    test('renders a row for an attribute with a value', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program')], [value('program', 'opt_program')]),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
        expect(screen.getByTestId('attributeChip')).toHaveTextContent('PROGRAM');
    });

    test('renders a required attribute with no value as Not set', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program', {required: true})], []),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
        expect(screen.getByText('Not set')).toBeInTheDocument();
        expect(screen.queryByTestId('attributeChip')).not.toBeInTheDocument();
    });

    test('omits an optional attribute with no value rather than showing an empty row', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program')], []),
        );

        expect(screen.queryByTestId('channelInfoAttributes')).not.toBeInTheDocument();
    });

    test('marks a locked attribute rather than hiding it', () => {
        // Hiding it would make a correctly configured channel look like one
        // missing a marking.
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program', {editable: false})], [value('program', 'opt_program')]),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
        expect(screen.getByLabelText('This attribute cannot be changed after it is set')).toBeInTheDocument();
    });

    test('treats an attribute with no editable key as editable', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program')], [value('program', 'opt_program')]),
        );

        expect(screen.queryByLabelText('This attribute cannot be changed after it is set')).not.toBeInTheDocument();
    });

    test('renders nothing when the feature flag is off', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program')], [value('program', 'opt_program')], 'false'),
        );

        expect(screen.queryByTestId('channelInfoAttributes')).not.toBeInTheDocument();
    });

    test('renders nothing for an attribute designated only for the header', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program', {actions: ['display_label_header']})], [value('program', 'opt_program')]),
        );

        expect(screen.queryByTestId('channelInfoAttributes')).not.toBeInTheDocument();
    });
});
