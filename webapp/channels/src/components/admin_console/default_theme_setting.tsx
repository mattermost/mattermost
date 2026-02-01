// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useEffect} from 'react';
import {useIntl} from 'react-intl';

import {Preferences} from 'mattermost-redux/constants';

import SchemaText from 'components/admin_console/schema_text';

import {toTitleCase} from 'utils/utils';

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
    const customThemes = props.state['ThemeSettings.CustomThemes'];
    const allowedThemes = props.state['ThemeSettings.AllowedThemes'];

    const options = useMemo(() => {
        const options: Option[] = [];
        Object.keys(Preferences.THEMES).forEach((theme) => {
            if (allowedThemes.indexOf(theme) !== -1) {
                options.push({value: theme, text: toTitleCase(theme)});
            }
        });
        customThemes.forEach((theme: CustomTheme) => {
            if (allowedThemes.indexOf(theme.ID) !== -1) {
                options.push({value: theme.ID, text: theme.Name});
            }
        });
        return options;
    }, [customThemes, allowedThemes]);

    useEffect(() => {
        if (props.onChange && props.state['ThemeSettings.AllowedThemes'].indexOf(props.value) === -1) {
            props.onChange(props.id, props.state['ThemeSettings.AllowedThemes'][0]);
        }
    }, [props.value, props.state['ThemeSettings.AllowedThemes']]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        if (props.onChange) {
            props.onChange(props.id, e.target.value);
        }
    }, [props.id, props.onChange]);

    return (
        <Setting
            label={intl.formatMessage({
                id: 'admin.themes.default_theme.title',
                defaultMessage: 'Default Theme (Enterprise):',
            })}
            inputId={props.id}
        >
            <select
                onChange={handleChange}
                className='form-control'
                disabled={props.disabled}
                value={props.value}
            >
                {options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                    >
                        {option.text}
                    </option>
                ))}
            </select>
            <div className='help-text'>
                <SchemaText text={intl.formatMessage({id: 'admin.experimental.defaultTheme.desc', defaultMessage: 'Set a default theme that applies to all new users on the system.'})}/>
            </div>
        </Setting>
    );
};

export default React.memo(DefaultThemeSetting);
