// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {Preferences} from 'mattermost-redux/constants';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import ThemeThumbnail from 'components/user_settings/display/user_settings_theme/theme_thumbnail';
import CustomThemeChooser from 'components/user_settings/display/user_settings_theme/custom_theme_chooser/custom_theme_chooser';
import SchemaText from 'components/admin_console/schema_text';

import {generateId} from 'utils/utils';

import Setting from './setting';

const CustomThemeContainer = styled.div`
    margin-bottom: 20px;
    border: 1px solid var(--center-channel-color-24);
    padding: 10px;
    background: white;
    box-shadow: 0px 2px 3px 0px rgba(0, 0, 0, 0.08);
    border-radius: 4px;
    .mt-3 .btn {
        display: none;
    }
    .theme-elements > div:first-child {
        margin: 10px 20px 0 20px;
    }
    textarea {
        height: 230px;
    }
`

const CustomThemeHeader = styled.div`
    display: flex;
    align-items: center;
    cursor: pointer;
    .theme-label {
        margin-left: 10px;
        font-size: 18px;
        font-weight: 600;
        flex-grow: 1;
    }
`

const CustomThemeBody = styled.div`
    margin-top: 10px;
`

const DeleteIcon = styled.i`
    color: #ea6262;
    cursor: pointer;
`

type CustomTheme = {
    ID: string;
    Name: string;
    Theme: string;
}

type Props = {
    id: string;
    value: CustomTheme[];
    onChange?: (id: string, themes: CustomTheme[]) => void;
    disabled?: boolean;
}

const CustomThemesSetting = (props: Props) => {
    const intl = useIntl();
    const [openTheme, setOpenTheme] = React.useState<string | null>(null);

    const handleChange = useCallback((themes: CustomTheme[]) => {
        if (props.onChange) {
            props.onChange(props.id, themes);
        }
    }, [props.id, props.onChange]);

    const newTheme: CustomTheme = {ID: generateId(), Name: intl.formatMessage({id: 'admin.themes.custom_theme.new', defaultMessage: 'New Theme'}), Theme: JSON.stringify(Preferences.THEMES['denim'])};

    if (props.disabled) {
        return (
            <Setting
                label={intl.formatMessage({
                    id: 'admin.themes.custom_theme.title',
                    defaultMessage: 'Brand themes (Enterprise):',
                })}
                inputId={props.id}
            >
                <div className='help-text'>
                    <SchemaText text={intl.formatMessage({id: 'admin.themes.custom_theme.disabled', defaultMessage: 'Custom themes are only available if you have custom branding enable and enterprise license.'})} />
                </div>
            </Setting>
        )
    }

    return (
        <Setting
            label={intl.formatMessage({
                id: 'admin.themes.custom_theme.title',
                defaultMessage: 'Brand themes (Enterprise):',
            })}
            inputId={props.id}
        >
            {props.value.map((theme: CustomTheme) => {
                const data = {...Object.values(Preferences.THEMES)[0], ...JSON.parse(theme.Theme)}
                data.type = theme.ID
                return (
                    <CustomThemeContainer onClick={() => openTheme === theme.ID ? setOpenTheme(null) : setOpenTheme(theme.ID)}>
                        <CustomThemeHeader>
                            <ThemeThumbnail
                                themeKey={theme.ID}
                                themeName={data.type}
                                sidebarBg={data.sidebarBg}
                                sidebarText={changeOpacity(data.sidebarText, 0.48)}
                                sidebarHeaderBg={data.sidebarHeaderBg}
                                sidebarHeaderTextColor={changeOpacity(data.sidebarHeaderTextColor, 0.48)}
                                sidebarUnreadText={data.sidebarUnreadText}
                                onlineIndicator={data.onlineIndicator}
                                awayIndicator={data.awayIndicator}
                                dndIndicator={data.dndIndicator}
                                centerChannelColor={changeOpacity(data.centerChannelColor, 0.16)}
                                centerChannelBg={data.centerChannelBg}
                                newMessageSeparator={data.newMessageSeparator}
                                buttonBg={data.buttonBg}
                            />
                            <div className='theme-label'>{theme.Name}</div>
                            <DeleteIcon
                                className='icon icon-trash-can-outline'
                                onClick={() => { handleChange(props.value.filter((t) => t.ID !== theme.ID)); setOpenTheme(null)}}
                            />
                            {openTheme !== theme.ID && <i className='icon icon-chevron-down'/>}
                            {openTheme === theme.ID && <i className='icon icon-chevron-up'/>}
                        </CustomThemeHeader>
                        {openTheme === theme.ID &&
                            <CustomThemeBody onClick={(e) => e.stopPropagation()}>
                                <input
                                    className='form-control'
                                    value={theme.Name}
                                    onChange={(e) => handleChange(props.value.map((t) => t.ID === openTheme ? {ID: t.ID, Name: e.target.value, Theme: t.Theme} : t))}
                                />
                                <CustomThemeChooser
                                    theme={data}
                                    updateTheme={(theme: any) => {
                                        handleChange(props.value.map((t) => t.ID === openTheme ? {ID: t.ID, Name: t.Name, Theme: JSON.stringify(theme)} : t));
                                    }}
                                />
                                <button
                                    className='btn btn-tertiary'
                                    onClick={() => { handleChange(props.value.filter((t) => t.ID !== openTheme)); setOpenTheme(null)}}
                                >
                                    <FormattedMessage
                                        id='admin.themes.custom_theme.delete'
                                        defaultMessage='Delete'
                                    />
                                </button>
                            </CustomThemeBody>}
                    </CustomThemeContainer>
                );
            })}

            <button
                className='btn btn-tertiary'
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleChange([...props.value, newTheme]); setOpenTheme(newTheme.ID)}}
            >
                <FormattedMessage
                    id='admin.themes.custom_theme.add'
                    defaultMessage='+ Add custom theme'
                />
            </button>
        </Setting>
    );
};

export default React.memo(CustomThemesSetting);
