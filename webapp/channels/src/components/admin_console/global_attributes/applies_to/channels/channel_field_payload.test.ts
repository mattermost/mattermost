// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';

import {buildChannelFieldPatch, buildChannelFieldPayload, parseChannelFieldConfig} from './channel_field_payload';
import type {ChannelDisplayLocation, ChannelResourceConfig} from './types';
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

    it('always pins channel admin, never leaving the tier to the server', () => {
        // The server defaults a channel field to "member", so an omitted tier is a
        // silent grant to every channel member rather than an absent setting.
        for (const config of [
            DEFAULT_CHANNEL_RESOURCE_CONFIG,
            {...DEFAULT_CHANNEL_RESOURCE_CONFIG, required: true, changePolicy: 'never' as const},
            {...DEFAULT_CHANNEL_RESOURCE_CONFIG, displayLocations: [DISPLAY_LABEL_HEADER] as ChannelDisplayLocation[]},
        ]) {
            expect(buildChannelFieldPayload(template, config).permission_values).toBe('admin');
        }
    });

    it('leaves permission_field and permission_options to the server default', () => {
        const payload = buildChannelFieldPayload(template, DEFAULT_CHANNEL_RESOURCE_CONFIG);

        expect(payload).not.toHaveProperty('permission_field');
        expect(payload).not.toHaveProperty('permission_options');
    });
});

describe('parseChannelFieldConfig', () => {
    const channelField = (attrs: Record<string, unknown>) => ({
        ...template,
        object_type: 'channel',
        attrs,
    } as unknown as PropertyField);

    it('reads a field carrying no channel keys as the defaults', () => {
        expect(parseChannelFieldConfig(channelField({}))).toEqual(DEFAULT_CHANNEL_RESOURCE_CONFIG);
    });

    it('reads required, the change policy and the display locations', () => {
        const config = parseChannelFieldConfig(channelField({
            required: true,
            change_policy: 'raise_only',
            actions: [DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER],
        }));

        expect(config.required).toBe(true);
        expect(config.changePolicy).toBe('raise_only');

        // Canonical order, not the order the field happened to store them in.
        expect(config.displayLocations).toEqual([DISPLAY_LABEL_HEADER, DISPLAY_BANNER_TOP]);
    });

    it('reads a legacy editable=false as never, the way the server does', () => {
        expect(parseChannelFieldConfig(channelField({editable: false})).changePolicy).toBe('never');
    });

    it('drops an action the row cannot render', () => {
        // display_banner_bottom validates server-side but has no control here, so
        // carrying it through would let a save silently rewrite it.
        const config = parseChannelFieldConfig(channelField({actions: ['display_banner_bottom', DISPLAY_LABEL_INFO]}));

        expect(config.displayLocations).toEqual([DISPLAY_LABEL_INFO]);
    });

    it('round-trips whatever buildChannelFieldPayload wrote', () => {
        const configs: ChannelResourceConfig[] = [
            DEFAULT_CHANNEL_RESOURCE_CONFIG,
            {required: true, changePolicy: 'never', displayLocations: [DISPLAY_LABEL_HEADER]},
            {required: false, changePolicy: 'raise_only', displayLocations: [DISPLAY_LABEL_INFO, DISPLAY_BANNER_TOP]},
        ];

        for (const config of configs) {
            const payload = buildChannelFieldPayload(template, config);
            expect(parseChannelFieldConfig({...template, attrs: payload.attrs ?? {}} as PropertyField)).toEqual(config);
        }
    });
});

describe('buildChannelFieldPatch', () => {
    it('writes every key on every save, so a merge cannot leave a stale one behind', () => {
        expect(buildChannelFieldPatch(DEFAULT_CHANNEL_RESOURCE_CONFIG).attrs).toEqual({
            required: false,
            change_policy: 'any',
            editable: null,
            actions: [],
        });
    });

    it('clears editable when the policy is no longer never', () => {
        // editable predates change_policy and still wins when change_policy is
        // absent, so a stale false would keep the attribute locked. Only an explicit
        // null removes it.
        expect(buildChannelFieldPatch({...DEFAULT_CHANNEL_RESOURCE_CONFIG, changePolicy: 'raise_only'}).attrs).toMatchObject({
            change_policy: 'raise_only',
            editable: null,
        });
    });

    it('writes editable alongside never, for readers that predate change_policy', () => {
        expect(buildChannelFieldPatch({...DEFAULT_CHANNEL_RESOURCE_CONFIG, changePolicy: 'never'}).attrs).toMatchObject({
            change_policy: 'never',
            editable: false,
        });
    });
});
