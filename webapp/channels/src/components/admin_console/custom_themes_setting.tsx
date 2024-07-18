// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {Preferences} from 'mattermost-redux/constants';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import SchemaText from 'components/admin_console/schema_text';
import CustomThemeChooser from 'components/user_settings/display/user_settings_theme/custom_theme_chooser/custom_theme_chooser';
import ThemeThumbnail from 'components/user_settings/display/user_settings_theme/theme_thumbnail';

import {generateId} from 'utils/utils';

import Setting from './setting';

const CustomThemeContainer = styled.div`
    margin-bottom: 12px;
    border: var(--border-default);
    background: white;
    box-shadow: var(--elevation-1);
    border-radius: var(--radius-s);

    .mt-3 .btn {
        display: none;
    }

    textarea {
        height: 230px;
    }

    &:hover {
        box-shadow: var(--elevation-2);
    }
`;

const CustomThemeHeader = styled.div`
    padding: 12px;
    display: flex;
    align-items: center;
    cursor: pointer;
    border-bottom: var(--border-light);

    .theme-label {
        margin-left: 16px;
        font-weight: 600;
        flex-grow: 1;
    }

    .theme-thumbnail {
        border-radius: var(--radius-s);
        border: var(--border-default);
        width: 85px;
        height: 64px;
        overflow: hidden;
    }
`;

const CustomThemeBody = styled.div`
    padding: 24px;

    .appearance-section {
        margin-top: 8px;

        .theme-elements {
            margin: 0;

            > div {
                margin-right: 0;
            }

            .form-group {
                margin: 0;
                padding: 0 20px 20px 0;

                .color-input {
                    width: auto;
                }
            }
        }
    }
`;

const DeleteIcon = styled.i`
    color: var(--error-text);
`;

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

    const newTheme: CustomTheme = {ID: generateId(), Name: intl.formatMessage({id: 'admin.themes.custom_theme.new', defaultMessage: 'New Theme'}), Theme: JSON.stringify(Preferences.THEMES.denim)};

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
                    <SchemaText text={intl.formatMessage({id: 'admin.themes.custom_theme.disabled', defaultMessage: 'Custom themes are only available if you have custom branding enable and enterprise license.'})}/>
                </div>
            </Setting>
        );
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
                const data = {...Object.values(Preferences.THEMES)[0], ...JSON.parse(theme.Theme)};
                data.type = theme.ID;
                return (
                    <CustomThemeContainer
                        key={theme.ID}
                        onClick={() => (openTheme === theme.ID ? setOpenTheme(null) : setOpenTheme(theme.ID))}
                    >
                        <CustomThemeHeader>
                            <div className='theme-thumbnail'>
                                <ThemeThumbnail
                                    width={85}
                                    height={64}
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
                            </div>
                            <div className='theme-label'>{theme.Name}</div>
                            <button
                                className='btn btn-sm btn-icon'
                                onClick={() => {
                                    handleChange(props.value.filter((t) => t.ID !== theme.ID));
                                    setOpenTheme(null);
                                }}
                            >
                                <DeleteIcon
                                    className='icon icon-trash-can-outline'
                                />
                            </button>
                            <button
                                className='btn btn-sm btn-icon'
                            >
                                {openTheme !== theme.ID && <i className='icon icon-chevron-down'/>}
                                {openTheme === theme.ID && <i className='icon icon-chevron-up'/>}
                            </button>
                        </CustomThemeHeader>
                        {openTheme === theme.ID &&
                        <CustomThemeBody onClick={(e) => e.stopPropagation()}>
                            <input
                                className='form-control'
                                value={theme.Name}
                                onChange={(e) => handleChange(props.value.map((t) => (t.ID === openTheme ? {ID: t.ID, Name: e.target.value, Theme: t.Theme} : t)))}
                            />
                            <CustomThemeChooser
                                theme={data}
                                updateTheme={(theme: any) => {
                                    handleChange(props.value.map((t) => (t.ID === openTheme ? {ID: t.ID, Name: t.Name, Theme: JSON.stringify(theme)} : t)));
                                }}
                            />
                        </CustomThemeBody>}
                    </CustomThemeContainer>
                );
            })}

            <button
                className='btn btn-tertiary'
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleChange([...props.value, newTheme]);
                    setOpenTheme(newTheme.ID);
                }}
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
