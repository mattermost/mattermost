// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {PluginConfiguration} from 'types/plugins/user_settings';

import PluginSetting from './plugin_setting';

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

    return (
        <div id={`pluginSetting${settings.id}`}>
            <div className='modal-header'>
                <button
                    id='closeButton'
                    type='button'
                    className='close'
                    data-dismiss='modal'
                    onClick={closeModal}
                >
                    <span aria-hidden='true'>{'×'}</span>
                </button>
                <h4 className='modal-title'>
                    <div className='modal-back'>
                        <i
                            className='fa fa-angle-left'
                            aria-label={
                                intl.formatMessage({
                                    id: 'generic_icons.collapse',
                                    defaultMessage: 'Collapse Icon',
                                })
                            }
                            onClick={collapseModal}
                        />
                    </div>
                    <FormattedMessage
                        id='user.settings.plugins.title'
                        defaultMessage='{pluginName} Settings'
                        values={{pluginName: settings.uiName}}
                    />
                </h4>
            </div>
            <div className='user-settings'>
                <div className={'pluginSettingsModalHeader'}>
                    <h3
                        id={`pluginSettings${settings.id}Title`}
                        className='tab-header'
                    >
                        {settings.uiName}
                    </h3>
                </div>
                <div className='divider-dark first'/>
                {settings.settings.map(
                    (v) =>
                        (<React.Fragment key={v.name}>
                            <PluginSetting
                                pluginId={settings.id}
                                activeSection={activeSection}
                                setting={v}
                                updateSection={updateSection}
                            />
                            <div className='divider-light'/>
                        </React.Fragment>),
                )}
                <div className='divider-dark'/>
            </div>
        </div>
    );
};

export default PluginTab;
