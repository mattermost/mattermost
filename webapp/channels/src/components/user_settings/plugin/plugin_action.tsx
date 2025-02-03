// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useMemo} from 'react';

import SectionNotice from 'components/section_notice';

import type {PluginConfigurationAction} from 'types/plugins/user_settings';

import './plugin_action.scss';

type Props = {
    action?: PluginConfigurationAction;
};

const PluginAction = ({
    action,
}: Props) => {
    const props = useMemo<ComponentProps<typeof SectionNotice>>(() => {
        return action ? {
            text: action.text,
            title: action.title,
            primaryButton: {
                onClick: action?.onClick,
                text: action?.buttonText,
            },
        } : {
            text: '',
            title: '',
        };
    }, [action]);

    if (!action) {
        return null;
    }

    return (
        <div className={'pluginActionContainer'}>
            <SectionNotice {...props}/>
        </div>
    );
};

export default PluginAction;
