// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useEffect} from 'react';
import {useIntl} from 'react-intl';
import ReactSelect from 'react-select';
import type {ValueType} from 'react-select';

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
    value: string[];
    state: any;
    onChange?: (id: string, themes: string[]) => void;
    disabled?: boolean;
    setByEnv?: boolean;
}

const AllowedThemesSetting = (props: Props) => {
    const intl = useIntl();

    const [options, allThemes] = useMemo(() => {
        const allThemes: {[key: string]: string} = {};
        const options: Option[] = [];
        Object.keys(Preferences.THEMES).forEach((theme) => {
            allThemes[theme] = toTitleCase(theme);
            options.push({value: theme, text: toTitleCase(theme)});
        });
        props.state['ThemeSettings.CustomThemes'].forEach((theme: CustomTheme) => {
            allThemes[theme.ID] = theme.Name;
            options.push({value: theme.ID, text: theme.Name});
        });
        return [options, allThemes];
    }, [props.state['ThemeSettings.CustomThemes']]);

    const getOptionLabel = ({text}: { text: string}) => text;

    useEffect(() => {
        const values = props.value.filter((value) => allThemes[value]);
        if (props.onChange && values.length !== props.value.length) {
            props.onChange(props.id, values);
        }
    }, [allThemes]);

    const handleChange = useCallback((newValue: ValueType<Option>) => {
        const values = newValue ? (newValue as Option[]).map((n) => {
            return n.value;
        }) : [];

        if (props.onChange) {
            props.onChange(props.id, values);
        }
    }, [props.id, props.onChange, allThemes]);

    return (
        <Setting
            label={intl.formatMessage({
                id: 'admin.themes.allowed_themes.title',
                defaultMessage: 'Allowed Themes (Enterprise):',
            })}
            inputId={props.id}
        >
            <ReactSelect
                id={props.id}
                isMulti={true}
                options={options}
                getOptionLabel={getOptionLabel}
                delimiter={','}
                clearable={false}
                isDisabled={props.disabled || props.setByEnv}
                noResultsText={intl.formatMessage({
                    id: 'admin.themes.allowed_themes.no_themes_found',
                    defaultMessage: 'No themes found',
                })}
                onChange={handleChange}
                value={props.value.map((theme) => {
                    return {value: theme, text: allThemes[theme]};
                })}
            />
            <div className='help-text'>
                <SchemaText text={intl.formatMessage({id: 'admin.themes.allowed_themes.help_text', defaultMessage: 'Choose the themes you’d like to make available to users on the server. If left empty, there will bo no limits on available themes.'})}/>
            </div>
        </Setting>
    );
};

export default React.memo(AllowedThemesSetting);
