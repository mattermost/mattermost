// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import {SettingsTypes} from 'utils/constants';

import type {LDAPDefinitionSetting, GeneralSettingProps} from './ldap_wizard';

import {renderLabel} from '../schema_admin_settings';

type ExpandableSettingProps = {
    buildSettingFunction: (setting: LDAPDefinitionSetting) => React.ReactNode;
} & GeneralSettingProps

const LDAPExpandableSetting = (props: ExpandableSettingProps) => {
    const intl = useIntl();
    const [expanded, setExpanded] = useState(false);

    if (!props.schema || !props.setting.key || props.setting.type !== SettingsTypes.TYPE_EXPANDABLE_SETTING) {
        return (<></>);
    }

    const toggleExpanded = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpanded(!expanded);
    };

    // Get the settings array from the expandable section setting
    const settings = props.setting.settings || [];
    const label = renderLabel(props.setting, props.schema, intl);
    const contentId = `ldap-expandable-content-${props.setting.key}`;

    return (
        <div className='ldap-expandable-section'>
            <div className='ldap-expandable-section-header'>
                <button
                    data-testid={`${props.setting.key}button`}
                    className='ldap-expandable-section-toggle'
                    onClick={toggleExpanded}
                    aria-expanded={expanded}
                    aria-controls={contentId}
                >
                    {label}
                </button>
                <i className={`fa fa-caret-right ldap-expandable-arrow ${expanded ? 'open' : ''}`}/>
            </div>
            <div
                id={contentId}
                className={`ldap-expandable-section-content ${expanded ? 'expanded' : ''}`}
            >
                {settings.map((setting: LDAPDefinitionSetting, index: number) => (
                    <div key={setting.key || `setting-${index}`}>
                        {props.buildSettingFunction(setting)}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LDAPExpandableSetting;
