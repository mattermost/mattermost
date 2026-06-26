// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {extractChannelSettingsTab} from './channel_settings_extraction';

describe('extractChannelSettingsTab', () => {
    const CustomTab = () => <div/>;
    const onSave = jest.fn(async () => {});

    function baseFields(overrides: Record<string, unknown> = {}) {
        return {
            id: 'tab-1',
            pluginId: 'plugin-a',
            uiName: 'My Tab',
            ...overrides,
        };
    }

    const schemaPayload = {
        sections: [
            {
                title: 'Section A',
                settings: [
                    {
                        name: 'color',
                        type: 'radio',
                        default: 'red',
                        options: [{value: 'red', text: 'Red'}, {value: 'blue', text: 'Blue'}],
                    },
                ],
            },
        ],
        onSave,
    };

    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('rejects registrations without an id or pluginId', () => {
        expect(extractChannelSettingsTab({pluginId: 'p', uiName: 'x', component: CustomTab})).toBeUndefined();
        expect(extractChannelSettingsTab({id: 't', uiName: 'x', component: CustomTab})).toBeUndefined();
    });

    it('rejects a non-function shouldRender', () => {
        expect(extractChannelSettingsTab(baseFields({component: CustomTab, shouldRender: 'nope'}))).toBeUndefined();
    });

    it('normalizes a custom tab registration', () => {
        const result = extractChannelSettingsTab(baseFields({component: CustomTab, icon: 'icon-x'}));

        expect(result).toBeDefined();
        expect(result?.kind).toBe('custom');
        expect(result?.uiName).toBe('My Tab');
        expect(result?.icon).toBe('icon-x');
        expect(typeof result?.shouldRender).toBe('function');
        expect(result?.shouldRender({} as never, {} as never)).toBe(true);
    });

    it('rejects a custom tab without a uiName', () => {
        expect(extractChannelSettingsTab({id: 't', pluginId: 'p', component: CustomTab})).toBeUndefined();
    });

    it('rejects a custom tab whose component is not renderable', () => {
        expect(extractChannelSettingsTab(baseFields({component: 'not-a-component'}))).toBeUndefined();
    });

    it('normalizes a schema tab registration', () => {
        const result = extractChannelSettingsTab(baseFields(schemaPayload));

        expect(result).toBeDefined();
        expect(result?.kind).toBe('schema');
        if (result?.kind !== 'schema') {
            throw new Error('expected schema tab');
        }
        expect(result.schema.onSave).toBe(onSave);
        expect(result.schema.sections).toHaveLength(1);
    });

    it('preserves a valid loadValues hook on a schema tab', () => {
        const loadValues = jest.fn(async () => ({color: 'blue'}));
        const result = extractChannelSettingsTab(baseFields({...schemaPayload, loadValues}));

        if (result?.kind !== 'schema') {
            throw new Error('expected schema tab');
        }
        expect(result.schema.loadValues).toBe(loadValues);
    });

    it('rejects a schema tab whose loadValues is not a function', () => {
        expect(extractChannelSettingsTab(baseFields({...schemaPayload, loadValues: 'nope'}))).toBeUndefined();
    });

    it('rejects a schema tab without onSave', () => {
        const withoutOnSave: Record<string, unknown> = {...schemaPayload};
        delete withoutOnSave.onSave;
        expect(extractChannelSettingsTab(baseFields(withoutOnSave))).toBeUndefined();
    });

    it('rejects a schema tab with no valid sections', () => {
        expect(extractChannelSettingsTab(baseFields({sections: [], onSave}))).toBeUndefined();
    });

    it('preserves a provided shouldRender', () => {
        const shouldRender = jest.fn(() => false);
        const result = extractChannelSettingsTab(baseFields({component: CustomTab, shouldRender}));

        expect(result?.shouldRender).toBe(shouldRender);
    });
});
