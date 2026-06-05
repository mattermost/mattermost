// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {extractSettingsSchema} from './extract_settings_schema';
import type {RadioSetting} from './types';

describe('extractSettingsSchema', () => {
    const Valid = () => <div/>;

    const radioSetting = {
        name: 'color',
        type: 'radio',
        default: 'red',
        options: [
            {value: 'red', text: 'Red'},
            {value: 'blue', text: 'Blue'},
        ],
    };

    function baseSchema(overrides: Record<string, unknown> = {}) {
        return {
            uiName: 'My Settings',
            sections: [
                {
                    title: 'Section A',
                    settings: [radioSetting],
                },
            ],
            ...overrides,
        };
    }

    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns undefined for non-objects', () => {
        expect(extractSettingsSchema(undefined, 'plugin')).toBeUndefined();
        expect(extractSettingsSchema(42, 'plugin')).toBeUndefined();
    });

    it('requires a string uiName', () => {
        expect(extractSettingsSchema(baseSchema({uiName: ''}), 'plugin')).toBeUndefined();
        expect(extractSettingsSchema(baseSchema({uiName: 5}), 'plugin')).toBeUndefined();
    });

    it('requires a non-empty sections array', () => {
        expect(extractSettingsSchema(baseSchema({sections: []}), 'plugin')).toBeUndefined();
        expect(extractSettingsSchema(baseSchema({sections: 'nope'}), 'plugin')).toBeUndefined();
    });

    it('rejects a non-string icon', () => {
        expect(extractSettingsSchema(baseSchema({icon: 5}), 'plugin')).toBeUndefined();
    });

    it('normalizes a valid radio schema', () => {
        const result = extractSettingsSchema(baseSchema({icon: 'icon-foo'}), 'plugin');

        expect(result).toBeDefined();
        expect(result?.uiName).toBe('My Settings');
        expect(result?.icon).toBe('icon-foo');
        expect(result?.sections).toHaveLength(1);

        const section = result!.sections[0];
        expect('settings' in section && section.settings[0].type).toBe('radio');
        const setting = (section as {settings: RadioSetting[]}).settings[0];
        expect(setting.options).toHaveLength(2);
    });

    it('drops invalid settings but keeps valid ones', () => {
        const schema = baseSchema({
            sections: [
                {
                    title: 'Mixed',
                    settings: [radioSetting, {name: 'bad', type: 'unknown'}],
                },
            ],
        });

        const result = extractSettingsSchema(schema, 'plugin');
        expect(result).toBeDefined();
        const section = result!.sections[0];
        expect('settings' in section && section.settings).toHaveLength(1);
    });

    it('drops a section whose settings are all invalid', () => {
        const schema = baseSchema({
            sections: [
                {title: 'All bad', settings: [{name: 'bad', type: 'unknown'}]},
            ],
        });

        expect(extractSettingsSchema(schema, 'plugin')).toBeUndefined();
    });

    it('accepts a custom section with a renderable component', () => {
        const schema = baseSchema({
            sections: [
                {title: 'Custom', component: Valid},
            ],
        });

        const result = extractSettingsSchema(schema, 'plugin');
        expect(result).toBeDefined();
        expect('component' in result!.sections[0]).toBe(true);
    });

    it('rejects a custom section whose component is not renderable', () => {
        const schema = baseSchema({
            sections: [
                {title: 'Custom', component: 'not-a-component'},
            ],
        });

        expect(extractSettingsSchema(schema, 'plugin')).toBeUndefined();
    });

    it('accepts a custom setting with a renderable component', () => {
        const schema = baseSchema({
            sections: [
                {title: 'Section', settings: [{name: 'thing', type: 'custom', component: Valid}]},
            ],
        });

        const result = extractSettingsSchema(schema, 'plugin');
        expect(result).toBeDefined();
        const section = result!.sections[0];
        expect('settings' in section && section.settings[0].type).toBe('custom');
    });

    it('runs the extra validation hook and merges its result', () => {
        const onSave = jest.fn();
        const result = extractSettingsSchema<{onSave: unknown}>(baseSchema({onSave}), 'plugin', {
            extraValidation: (raw) => {
                if (!raw || typeof raw !== 'object' || !('onSave' in raw) || typeof raw.onSave !== 'function') {
                    return undefined;
                }
                return {onSave: raw.onSave};
            },
        });

        expect(result).toBeDefined();
        expect(result?.onSave).toBe(onSave);
    });

    it('rejects the whole schema when the extra validation hook fails', () => {
        const result = extractSettingsSchema<{onSave: unknown}>(baseSchema(), 'plugin', {
            extraValidation: () => undefined,
        });

        expect(result).toBeUndefined();
    });

    it('runs the section extra validation hook and merges its result per declarative section', () => {
        const onSubmit = jest.fn();
        const result = extractSettingsSchema<unknown, {onSubmit?: unknown}>(baseSchema({
            sections: [
                {title: 'Section A', settings: [radioSetting], onSubmit},
            ],
        }), 'plugin', {
            sectionExtraValidation: (section) => {
                if (!section || typeof section !== 'object') {
                    return undefined;
                }
                if ('onSubmit' in section && section.onSubmit) {
                    if (typeof section.onSubmit !== 'function') {
                        return undefined;
                    }
                    return {onSubmit: section.onSubmit};
                }
                return {};
            },
        });

        expect(result).toBeDefined();
        const section = result!.sections[0];
        expect('onSubmit' in section && section.onSubmit).toBe(onSubmit);
    });

    it('drops a declarative section when the section extra validation hook rejects it', () => {
        const result = extractSettingsSchema<unknown, Record<string, never>>(baseSchema({
            sections: [
                {title: 'Bad', settings: [radioSetting], onSubmit: 'not-a-function'},
                {title: 'Good', settings: [radioSetting]},
            ],
        }), 'plugin', {
            sectionExtraValidation: (section) => {
                if (section && typeof section === 'object' && 'onSubmit' in section && typeof section.onSubmit !== 'function') {
                    return undefined;
                }
                return {};
            },
        });

        expect(result).toBeDefined();
        expect(result?.sections).toHaveLength(1);
        expect(result?.sections[0].title).toBe('Good');
    });

    it('does not run the section hook for custom (component) sections', () => {
        const sectionExtraValidation = jest.fn(() => ({}));
        const result = extractSettingsSchema<unknown, Record<string, never>>(baseSchema({
            sections: [
                {title: 'Custom', component: Valid},
            ],
        }), 'plugin', {sectionExtraValidation});

        expect(result).toBeDefined();
        expect(sectionExtraValidation).not.toHaveBeenCalled();
    });

    it('drops sections with duplicate titles and warns', () => {
        const schema = baseSchema({
            sections: [
                {title: 'Same', settings: [radioSetting]},
                {title: 'Same', settings: [radioSetting]},
            ],
        });

        const result = extractSettingsSchema(schema, 'plugin');

        expect(result).toBeDefined();
        expect(result?.sections).toHaveLength(1);

        // eslint-disable-next-line no-console
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('duplicate title'));
    });
});
