// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {toTitleCase} from 'utils/utils';

import {Preferences} from 'mattermost-redux/constants';
import SchemaText from 'components/admin_console/schema_text';

import Setting from './setting';

type CustomTheme = {
    ID: string;
    Name: string;
    Theme: string;
}

type Option = {
    value: string;
    text: string;
}

type Props = {
    id: string;
    value: string;
    state: any;
    onChange?: (id: string, theme: string) => void;
    disabled?: boolean;
    setByEnv?: boolean;
}

const DefaultThemeSetting = (props: Props) => {
    const intl = useIntl();

    const options: Option[] = []
    Object.keys(Preferences.THEMES).forEach((theme) => {
        options.push({value: theme, text: toTitleCase(theme)})
    })
    props.state['ThemeSettings.CustomThemes'].forEach((theme: CustomTheme) => {
        options.push({value: theme.ID, text: theme.Name})
    })

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        if (props.onChange) {
            props.onChange(props.id, e.target.value);
        }
    }, [props.id, props.onChange]);

    return (
        <Setting
            label={intl.formatMessage({
                id: 'admin.themes.default_theme.title',
                defaultMessage: 'Default Theme',
            })}
            inputId={props.id}
        >
            <select onChange={handleChange} className='form-control'>
                {options.map((option) => <option value={option.value} selected={props.value === option.value}>{option.text}</option>)}
            </select>
            <div className='help-text'>
                <SchemaText text={intl.formatMessage({id: 'admin.experimental.defaultTheme.desc', defaultMessage: 'Set a default theme that applies to all new users on the system.'})} />
            </div>
        </Setting>
    );
};

export default React.memo(DefaultThemeSetting);
