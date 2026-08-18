// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';

import {buildChannelFieldPayload} from './channel_field_payload';
import type {ChannelDisplayLocation} from './types';
import {DEFAULT_CHANNEL_RESOURCE_CONFIG} from './types';

const template = {
    id: 'template_field_id_1234567890',
    group_id: 'group_id_12345678901234567',
    name: 'program',
    type: 'select',
    target_type: 'system',
    target_id: '',
    object_type: 'template',
    attrs: {options: [{id: 'option_id_1', name: 'Aurora'}]},
    create_at: 1,
    update_at: 1,
    delete_at: 0,
    created_by: 'admin',
    updated_by: 'admin',
} as unknown as PropertyField;

describe('buildChannelFieldPayload', () => {
    it('links to the template and copies the schema identity the server requires', () => {
        const payload = buildChannelFieldPayload(template, DEFAULT_CHANNEL_RESOURCE_CONFIG);

        expect(payload.linked_field_id).toBe(template.id);
        expect(payload.name).toBe('program');
        expect(payload.type).toBe('select');

        // The server rejects a linked field whose target_type differs from its
        // source template's.
        expect(payload.target_type).toBe('system');
        expect(payload.target_id).toBe('');
    });

    it('never sends options, which are inherited and rejected on a linked field', () => {
        const payload = buildChannelFieldPayload(template, {
            ...DEFAULT_CHANNEL_RESOURCE_CONFIG,
            required: true,
        });

        expect(payload.attrs).not.toHaveProperty('options');
    });

    it('omits attrs entirely when every channel setting is left at its default', () => {
        const payload = buildChannelFieldPayload(template, DEFAULT_CHANNEL_RESOURCE_CONFIG);

        expect(payload).not.toHaveProperty('attrs');
    });

    it('writes required only when it is on', () => {
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, required: false})).not.toHaveProperty('attrs.required');
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, required: true}).attrs).toEqual({required: true});
    });

    it('writes no change keys for the freely-changeable default', () => {
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, changePolicy: 'any'})).not.toHaveProperty('attrs');
    });

    it('writes editable alongside never, so readers that predate change_policy still lock', () => {
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, changePolicy: 'never'}).attrs).toEqual({
            change_policy: 'never',
            editable: false,
        });
    });

    it('writes a directional policy without touching editable, which cannot express it', () => {
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, changePolicy: 'raise_only'}).attrs).toEqual({change_policy: 'raise_only'});
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, changePolicy: 'lower_only'}).attrs).toEqual({change_policy: 'lower_only'});
    });

    it('writes actions only when at least one display location is chosen', () => {
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, displayLocations: []})).not.toHaveProperty('attrs.actions');

        const payload = buildChannelFieldPayload(template, {
            ...DEFAULT_CHANNEL_RESOURCE_CONFIG,
            displayLocations: [DISPLAY_LABEL_HEADER, DISPLAY_BANNER_TOP],
        });

        expect(payload.attrs).toEqual({actions: [DISPLAY_LABEL_HEADER, DISPLAY_BANNER_TOP]});
    });

    it('does not alias the caller-owned locations array into the payload', () => {
        const displayLocations: ChannelDisplayLocation[] = [DISPLAY_LABEL_INFO];
        const payload = buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, displayLocations});

        expect(payload.attrs).toEqual({actions: [DISPLAY_LABEL_INFO]});
        expect((payload.attrs as {actions: string[]}).actions).not.toBe(displayLocations);
    });

    it('carries the chosen setter tier', () => {
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, permissionValues: 'member'}).permission_values).toBe('member');
        expect(buildChannelFieldPayload(template, {...DEFAULT_CHANNEL_RESOURCE_CONFIG, permissionValues: 'admin'}).permission_values).toBe('admin');
    });

    it('leaves permission_field and permission_options to the server default', () => {
        const payload = buildChannelFieldPayload(template, DEFAULT_CHANNEL_RESOURCE_CONFIG);

        expect(payload).not.toHaveProperty('permission_field');
        expect(payload).not.toHaveProperty('permission_options');
    });
});
