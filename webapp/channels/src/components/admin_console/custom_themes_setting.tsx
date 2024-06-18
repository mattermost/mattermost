// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {Preferences} from 'mattermost-redux/constants';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import ThemeThumbnail from 'components/user_settings/display/user_settings_theme/theme_thumbnail';
import CustomThemeChooser from 'components/user_settings/display/user_settings_theme/custom_theme_chooser/custom_theme_chooser';

import {generateId} from 'utils/utils';

import Setting from './setting';

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

// TODO: Add i18n

const CustomThemesSetting = (props: Props) => {
    const [openTheme, setOpenTheme] = React.useState<string | null>(null);

    const handleChange = useCallback((themes: CustomTheme[]) => {
        if (props.onChange) {
            props.onChange(props.id, themes);
        }
    }, [props.id, props.onChange]);

    const newTheme: CustomTheme = {ID: generateId(), Name: 'New', Theme: '{}'};

    return (
        <Setting
            label={'Brand themes'}
            inputId={props.id}
        >
            {props.value.map((theme: CustomTheme) => {
                const data = {...Object.values(Preferences.THEMES)[0], ...JSON.parse(theme.Theme)}
                data.type = theme.ID
                return (
                    <div className='settings-table settings-content' onClick={() => openTheme === theme.ID ? setOpenTheme(null) : setOpenTheme(theme.ID)}>
                        <ThemeThumbnail
                            themeKey={theme.ID}
                            themeName={data.type}
                            sidebarBg={data.sidebarBg}
                            sidebarText={changeOpacity(data.sidebarText, 0.48)}
                            sidebarUnreadText={data.sidebarUnreadText}
                            onlineIndicator={data.onlineIndicator}
                            awayIndicator={data.awayIndicator}
                            dndIndicator={data.dndIndicator}
                            centerChannelColor={changeOpacity(data.centerChannelColor, 0.16)}
                            centerChannelBg={data.centerChannelBg}
                            newMessageSeparator={data.newMessageSeparator}
                            buttonBg={data.buttonBg}
                        />
                        {openTheme !== theme.ID &&
                            <div className='theme-label'>{theme.Name}</div>}
                        {openTheme === theme.ID &&
                            <div onClick={(e) => e.stopPropagation()}>
                                <input
                                    value={theme.Name}
                                    onChange={(e) => handleChange(props.value.map((t) => t.ID === openTheme ? {ID: t.ID, Name: e.target.value, Theme: t.Theme} : t))}
                                />
                                <CustomThemeChooser
                                    theme={data}
                                    updateTheme={(theme: any) => {
                                        handleChange(props.value.map((t) => t.ID === openTheme ? {ID: t.ID, Name: t.Name, Theme: JSON.stringify(theme)} : t));
                                    }}
                                />
                                <button onClick={() => { handleChange(props.value.filter((t) => t.ID !== openTheme)); setOpenTheme(null)}}>{'Delete'}</button>
                            </div>}
                    </div>
                );
            })}

            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleChange([...props.value, newTheme]); setOpenTheme(newTheme.ID)}}>{'+ Add custom theme'}</button>
        </Setting>
    );
            // <ColorInput
            //     id={props.id}
            //     value={props.value}
            //     onChange={handleChange}
            //     isDisabled={props.disabled}
            // />
};

export default React.memo(CustomThemesSetting);
