// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';
import Radio from 'plugins/settings_schema/controls/radio';
import type {Setting, SettingsSection, CustomSection} from 'plugins/settings_schema/types';

import type {ChannelSettingsSchema, ChannelSettingsTabHandlers, ChannelSettingsValues} from 'types/plugins/channel_settings';

type Props = {
    schema: ChannelSettingsSchema;
    pluginId: string;
    channel: Channel;
    setUnsaved: (unsaved: boolean) => void;
    registerHandlers: (handlers: ChannelSettingsTabHandlers | null) => void;
};

function isSettingsSection(section: SettingsSection | CustomSection): section is SettingsSection {
    return 'settings' in section;
}

function getDefaultValues(schema: ChannelSettingsSchema): ChannelSettingsValues {
    const values: ChannelSettingsValues = {};
    for (const section of schema.sections) {
        if (!isSettingsSection(section)) {
            continue;
        }
        for (const setting of section.settings) {
            if (setting.default !== undefined) {
                values[setting.name] = setting.default;
            }
        }
    }
    return values;
}

function isDirty(values: ChannelSettingsValues, baseline: ChannelSettingsValues): boolean {
    const keys = new Set([...Object.keys(values), ...Object.keys(baseline)]);
    for (const key of keys) {
        if (values[key] !== baseline[key]) {
            return true;
        }
    }
    return false;
}

const ChannelSettingsPluginSchemaTab = ({
    schema,
    pluginId,
    channel,
    setUnsaved,
    registerHandlers,
}: Props) => {
    const defaultValues = useMemo(() => getDefaultValues(schema), [schema]);
    const [baseline, setBaseline] = useState<ChannelSettingsValues>(defaultValues);
    const [values, setValues] = useState<ChannelSettingsValues>(defaultValues);

    // Hydrate from the plugin's own store when a loader is provided, falling
    // back to schema defaults. Controls stay hidden until hydration settles so
    // the user never edits stale values.
    const [loading, setLoading] = useState<boolean>(Boolean(schema.loadValues));

    const dirty = useMemo(() => isDirty(values, baseline), [values, baseline]);

    useEffect(() => {
        setUnsaved(dirty);
    }, [dirty, setUnsaved]);

    useEffect(() => {
        if (!schema.loadValues) {
            return undefined;
        }

        let active = true;
        setLoading(true);
        Promise.resolve(schema.loadValues(channel)).then((loaded) => {
            if (!active) {
                return;
            }
            const hydrated = {...defaultValues, ...loaded};
            setBaseline(hydrated);
            setValues(hydrated);
            setLoading(false);
        }).catch(() => {
            if (!active) {
                return;
            }

            // Fall back to defaults; the plugin owns surfacing its own errors.
            setLoading(false);
        });

        return () => {
            active = false;
        };
    }, [schema, channel, defaultValues]);

    const onChange = useCallback((name: string, value: string) => {
        setValues((prev) => ({...prev, [name]: value}));
    }, []);

    const save = useCallback(async () => {
        await schema.onSave(values, channel);
        setBaseline(values);
    }, [schema, values, channel]);

    const reset = useCallback(() => {
        setValues(baseline);
    }, [baseline]);

    const handlersRef = useRef({save, reset});
    handlersRef.current = {save, reset};

    useEffect(() => {
        registerHandlers({
            save: () => handlersRef.current.save(),
            reset: () => handlersRef.current.reset(),
        });
        return () => registerHandlers(null);
    }, [registerHandlers]);

    if (loading) {
        return (
            <div className='ChannelSettingsModal__schemaTab'>
                <FormattedMessage
                    id='channel_settings.plugin_schema_tab.loading'
                    defaultMessage='Loading…'
                />
            </div>
        );
    }

    return (
        <div className='ChannelSettingsModal__schemaTab'>
            {schema.sections.map((section, index) => (
                <section

                    // Section titles are unique post-extraction, but index keeps the
                    // key stable without depending on that invariant in the renderer.
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    className='ChannelSettingsModal__schemaSection'
                >
                    <h4 className='ChannelSettingsModal__schemaSectionTitle'>{section.title}</h4>
                    {renderSectionBody(section, pluginId, values, onChange)}
                </section>
            ))}
        </div>
    );
};

function renderSectionBody(
    section: SettingsSection | CustomSection,
    pluginId: string,
    values: ChannelSettingsValues,
    onChange: (name: string, value: string) => void,
) {
    if (!isSettingsSection(section)) {
        const CustomComponent = section.component;
        return (
            <PluggableErrorBoundary pluginId={pluginId}>
                <CustomComponent/>
            </PluggableErrorBoundary>
        );
    }

    return section.settings.map((setting) => renderSetting(setting, pluginId, values, onChange));
}

function renderSetting(
    setting: Setting,
    pluginId: string,
    values: ChannelSettingsValues,
    onChange: (name: string, value: string) => void,
) {
    switch (setting.type) {
    case 'radio':
        return (
            <Radio
                key={setting.name}
                setting={setting}
                value={values[setting.name] ?? setting.default}
                onChange={(value) => onChange(setting.name, value)}
            />
        );
    case 'custom': {
        const CustomComponent = setting.component;
        return (
            <PluggableErrorBoundary
                key={setting.name}
                pluginId={pluginId}
            >
                <CustomComponent informChange={onChange}/>
            </PluggableErrorBoundary>
        );
    }
    default:
        return null;
    }
}

export default ChannelSettingsPluginSchemaTab;
