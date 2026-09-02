// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import noop from 'lodash/noop';
import React, {useCallback, useRef} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';

import type {ChannelSettingsTabHandlers} from 'types/plugins/channel_settings';
import type {ChannelSettingsTabComponent} from 'types/store/plugins';

import ChannelSettingsPluginSchemaTab from './channel_settings_plugin_schema_tab';

type Props = {
    channel: Channel;
    registration: ChannelSettingsTabComponent;
    areThereUnsavedChanges: boolean;
    showTabSwitchError: boolean;
    setUnsaved: (unsaved: boolean) => void;
};

// Renders a plugin-provided channel settings tab (declarative schema or a
// custom component) and owns its save bar, mirroring how the built-in tabs
// manage their own save state. The tab body drives the bar by registering
// save/reset handlers and reporting unsaved changes through `setUnsaved`.
export default function ChannelSettingsPluginTab({
    channel,
    registration,
    areThereUnsavedChanges,
    showTabSwitchError,
    setUnsaved,
}: Props) {
    const handlersRef = useRef<ChannelSettingsTabHandlers | null>(null);

    const registerHandlers = useCallback((handlers: ChannelSettingsTabHandlers | null) => {
        handlersRef.current = handlers;
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!handlersRef.current) {
            return;
        }
        try {
            await handlersRef.current.save();
            setUnsaved(false);
        } catch {
            // The plugin owns user-visible errors; dirty state remains until the plugin clears it.
        }
    }, [setUnsaved]);

    const handleCancel = useCallback(() => {
        handlersRef.current?.reset();
        setUnsaved(false);
    }, [setUnsaved]);

    return (
        <>
            <div className='ChannelSettingsModal__pluginTab'>
                {registration.kind === 'schema' ? (
                    <ChannelSettingsPluginSchemaTab
                        schema={registration.schema}
                        pluginId={registration.pluginId}
                        channel={channel}
                        setUnsaved={setUnsaved}
                        registerHandlers={registerHandlers}
                    />
                ) : (
                    <PluggableErrorBoundary pluginId={registration.pluginId}>
                        <registration.component
                            channel={channel}
                            setUnsaved={setUnsaved}
                            registerHandlers={registerHandlers}
                        />
                    </PluggableErrorBoundary>
                )}
            </div>
            {areThereUnsavedChanges && (
                <SaveChangesPanel
                    handleSubmit={handleSubmit}
                    handleCancel={handleCancel}
                    handleClose={noop}
                    tabChangeError={showTabSwitchError}
                    state={showTabSwitchError ? 'error' : 'editing'}
                    cancelButtonText={
                        <FormattedMessage
                            id='channel_settings.save_changes_panel.reset'
                            defaultMessage='Reset'
                        />
                    }
                />
            )}
        </>
    );
}
