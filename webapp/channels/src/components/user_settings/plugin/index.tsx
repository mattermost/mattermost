// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';

import type {PluginConfiguration} from 'types/plugins/user_settings';

import PluginAction from './plugin_action';
import PluginSetting from './plugin_setting';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';

type Props = {
    updateSection: (section: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
    settings: PluginConfiguration;
}

const PluginTab = ({
    activeSection,
    closeModal,
    collapseModal,
    settings,
    updateSection,
}: Props) => {
    const intl = useIntl();

    const headerText = intl.formatMessage(
        {id: 'user.settings.plugins.title', defaultMessage: '{pluginName} Settings'},
        {pluginName: settings.uiName},
    );

    return (
        <div
            id={`${settings.id}Settings`}
            aria-labelledby={`${settings.id}Button`}
            role='tabpanel'
        >
            <SettingMobileHeader
                closeModal={closeModal}
                collapseModal={collapseModal}
                text={headerText}
            />
            <div className='user-settings'>
                <SettingDesktopHeader text={headerText}/>
                <PluginAction action={settings.action}/>
                <div className='divider-dark first'/>
                {settings.sections.map((v) => {
                    let sectionEl;
                    if ('component' in v) {
                        const CustomComponent = v.component;
                        sectionEl = (
                            <PluggableErrorBoundary
                                pluginId={settings.id}
                            >
                                <CustomComponent/>
                            </PluggableErrorBoundary>
                        );
                    } else {
                        sectionEl = (
                            <PluginSetting
                                pluginId={settings.id}
                                activeSection={activeSection}
                                section={v}
                                updateSection={updateSection}
                            />
                        );
                    }

                    return (
                        <React.Fragment key={v.title}>
                            {sectionEl}
                            <div className='divider-light'/>
                        </React.Fragment>
                    );
                },
                )}
                <div className='divider-dark'/>
            </div>
        </div>
    );
};

export default PluginTab;
