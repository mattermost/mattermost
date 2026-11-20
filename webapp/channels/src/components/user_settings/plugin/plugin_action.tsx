// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';

import Markdown from 'components/markdown';

import type {PluginConfigurationAction} from 'types/plugins/user_settings';

import './plugin_action.scss';

type Props = {
    action?: PluginConfigurationAction;
};

const PluginAction = ({
    action,
}: Props) => {
    if (!action) {
        return null;
    }

    return (
        <div className={'pluginActionContainer'}>
            <SectionNotice
                title={action.title}
                description={action.text ? <Markdown message={action.text}/> : undefined}
                primaryButtonLabel={action.buttonText}
                onPrimaryAction={action.onClick}
            />
        </div>
    );
};

export default PluginAction;
