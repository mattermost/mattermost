// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    BaseSetting,
    CustomSection,
    CustomSetting,
    CustomSettingComponent,
    RadioSetting,
    RadioSettingOption,
    Setting,
    SettingsSchema,
    SettingsSection,
} from './types';

// Canonical base for declarative plugin settings. User Settings duplicates this
// today and should be migrated onto it in a follow-up PR (see types.ts).

/**
 * Validates a context-specific top-level field set (e.g. channel settings'
 * `onSave`). Return the extracted extra fields, or `undefined` to reject the
 * whole schema. Kept generic so callers (channel and user settings) can reuse
 * it.
 */
export type ExtraSchemaValidation<Extra> = (schema: unknown) => Extra | undefined;

/**
 * Validates a context-specific per-section field set (e.g. user settings'
 * `onSubmit`). Return the extracted extra fields to merge into the declarative
 * section, or `undefined` to drop that section (matching the default
 * drop-and-warn behavior). Only declarative sections are passed here; custom
 * (component) sections are left untouched.
 */
export type ExtraSectionValidation<SectionExtra> = (section: unknown) => SectionExtra | undefined;

type Options<Extra, SectionExtra> = {
    extraValidation?: ExtraSchemaValidation<Extra>;
    sectionExtraValidation?: ExtraSectionValidation<SectionExtra>;
};

type ExtractedSettingsSchema<Extra, SectionExtra> = Omit<SettingsSchema, 'sections'> & Extra & {
    sections: Array<(SettingsSection & SectionExtra) | CustomSection>;
};

/**
 * Defensively parses an untrusted settings schema into a normalized
 * {@link SettingsSchema}. Invalid pieces are dropped with a console warning so
 * a single malformed setting cannot break the host. The optional
 * `extraValidation` hook lets a calling context validate and pull in its own
 * top-level fields; `sectionExtraValidation` does the same per declarative
 * section.
 */
export function extractSettingsSchema<Extra = unknown, SectionExtra = unknown>(schema: unknown, pluginId: string, options: Options<Extra, SectionExtra> = {}): ExtractedSettingsSchema<Extra, SectionExtra> | undefined {
    if (!schema || typeof schema !== 'object') {
        return undefined;
    }

    if (!('uiName' in schema) || !schema.uiName || typeof schema.uiName !== 'string') {
        return undefined;
    }

    let icon;
    if ('icon' in schema && schema.icon) {
        if (typeof schema.icon === 'string') {
            icon = schema.icon;
        } else {
            return undefined;
        }
    }

    if (!('sections' in schema) || !Array.isArray(schema.sections) || !schema.sections.length) {
        return undefined;
    }

    let extra = {} as Extra;
    if (options.extraValidation) {
        const validatedExtra = options.extraValidation(schema);
        if (validatedExtra === undefined) {
            return undefined;
        }
        extra = validatedExtra;
    }

    const sections: Array<(SettingsSection & SectionExtra) | CustomSection> = [];
    const seenTitles = new Set<string>();
    for (const section of schema.sections) {
        const validSection = extractSection(section, pluginId, options.sectionExtraValidation);
        if (!validSection) {
            // eslint-disable-next-line no-console
            console.warn(`Plugin ${pluginId} is trying to register an invalid settings section. Contact the plugin developer to fix this issue.`);
            continue;
        }

        // Section titles must be unique; drop duplicates so the renderer can key safely.
        if (seenTitles.has(validSection.title)) {
            // eslint-disable-next-line no-console
            console.warn(`Plugin ${pluginId} is trying to register a settings section with a duplicate title "${validSection.title}". Contact the plugin developer to fix this issue.`);
            continue;
        }

        seenTitles.add(validSection.title);
        sections.push(validSection);
    }

    if (!sections.length) {
        return undefined;
    }

    return {
        uiName: schema.uiName,
        icon,
        sections,
        ...extra,
    };
}

function extractSection<SectionExtra>(section: unknown, pluginId: string, sectionExtraValidation?: ExtraSectionValidation<SectionExtra>): (SettingsSection & SectionExtra) | CustomSection | undefined {
    if (!section || typeof section !== 'object') {
        return undefined;
    }

    if (!('title' in section) || !section.title || typeof section.title !== 'string') {
        return undefined;
    }

    if ('component' in section) {
        if (!isRenderableComponent(section.component)) {
            return undefined;
        }

        return {
            title: section.title,
            component: section.component as React.ComponentType,
        };
    }

    if (!('settings' in section) || !Array.isArray(section.settings) || !section.settings.length) {
        return undefined;
    }

    let disabled;
    if ('disabled' in section && section.disabled !== undefined) {
        if (typeof section.disabled === 'boolean') {
            disabled = section.disabled;
        } else {
            return undefined;
        }
    }

    const settings: Setting[] = [];
    for (const setting of section.settings) {
        const validSetting = extractSetting(setting);
        if (validSetting) {
            settings.push(validSetting);
        } else {
            // eslint-disable-next-line no-console
            console.warn(`Plugin ${pluginId} is trying to register an invalid section setting. Contact the plugin developer to fix this issue.`);
        }
    }

    if (!settings.length) {
        return undefined;
    }

    let sectionExtra = {} as SectionExtra;
    if (sectionExtraValidation) {
        const validatedExtra = sectionExtraValidation(section);
        if (validatedExtra === undefined) {
            return undefined;
        }
        sectionExtra = validatedExtra;
    }

    return {
        title: section.title,
        settings,
        disabled,
        ...sectionExtra,
    };
}

function extractSetting(setting: unknown): Setting | undefined {
    if (!setting || typeof setting !== 'object') {
        return undefined;
    }

    if (!('name' in setting) || !setting.name || typeof setting.name !== 'string') {
        return undefined;
    }

    let title;
    if ('title' in setting && setting.title) {
        if (typeof setting.title === 'string') {
            title = setting.title;
        } else {
            return undefined;
        }
    }

    let helpText;
    if ('helpText' in setting && setting.helpText) {
        if (typeof setting.helpText === 'string') {
            helpText = setting.helpText;
        } else {
            return undefined;
        }
    }

    let defaultValue;
    if ('default' in setting && setting.default) {
        if (typeof setting.default === 'string') {
            defaultValue = setting.default;
        } else {
            return undefined;
        }
    }

    if (!('type' in setting) || !setting.type || typeof setting.type !== 'string') {
        return undefined;
    }

    const base: BaseSetting = {
        name: setting.name,
        title,
        helpText,
        default: defaultValue,
    };

    switch (setting.type) {
    case 'radio':
        return extractRadioSetting(setting, base);
    case 'custom':
        return extractCustomSetting(setting, base);
    default:
        return undefined;
    }
}

function extractRadioSetting(setting: object, base: BaseSetting): RadioSetting | undefined {
    if (!('default' in setting) || !setting.default || typeof setting.default !== 'string') {
        return undefined;
    }

    if (!('options' in setting) || !Array.isArray(setting.options)) {
        return undefined;
    }

    const options: RadioSettingOption[] = [];
    for (const option of setting.options) {
        const validOption = extractRadioOption(option);
        if (validOption) {
            options.push(validOption);
        }
    }

    if (!options.length) {
        return undefined;
    }

    return {
        ...base,
        type: 'radio',
        default: setting.default,
        options,
    };
}

function extractRadioOption(option: unknown): RadioSettingOption | undefined {
    if (!option || typeof option !== 'object') {
        return undefined;
    }

    if (!('value' in option) || !option.value || typeof option.value !== 'string') {
        return undefined;
    }

    if (!('text' in option) || !option.text || typeof option.text !== 'string') {
        return undefined;
    }

    let helpText;
    if ('helpText' in option && option.helpText) {
        if (typeof option.helpText === 'string') {
            helpText = option.helpText;
        } else {
            return undefined;
        }
    }

    return {
        value: option.value,
        text: option.text,
        helpText,
    };
}

function extractCustomSetting(setting: object, base: BaseSetting): CustomSetting | undefined {
    if (!('component' in setting) || !isRenderableComponent(setting.component)) {
        return undefined;
    }

    return {
        ...base,
        type: 'custom',
        component: setting.component as CustomSettingComponent,
    };
}

/** Confirms the value is a usable component (i.e. a function we can render). */
export function isRenderableComponent(component: unknown): boolean {
    if (typeof component !== 'function') {
        return false;
    }

    const Component = component as React.ComponentType;
    return React.isValidElement(<Component/>);
}
