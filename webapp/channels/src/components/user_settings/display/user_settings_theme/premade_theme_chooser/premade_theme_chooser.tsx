// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {Preferences} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import type {Theme, ThemeKey} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import {toTitleCase} from 'utils/utils';

import ThemeThumbnail from '../theme_thumbnail';

type Props = {
    theme: Theme;
    updateTheme: (theme: Theme) => void;
    allowedThemes: string[];
}

const PremadeThemeChooser = ({theme, updateTheme, allowedThemes = []}: Props) => {
    const premadeThemes = [];
    const hasAllowedThemes = allowedThemes.length > 1 || (allowedThemes[0] && allowedThemes[0].trim().length > 0);

    const config = useSelector(getConfig);

    const customThemes = JSON.parse(config.CustomThemes || '[]');
    customThemes.forEach((customTheme: any) => {
        if (hasAllowedThemes && allowedThemes.indexOf(customTheme.ID) < 0) {
            return;
        }
        const data = {...Object.values(Preferences.THEMES)[0], ...JSON.parse(customTheme.Theme)};
        data.ID = customTheme.ID;
        data.type = customTheme.ID;

        let activeClass = '';
        if (data.ID === theme.type) {
            activeClass = 'active';
        }

        premadeThemes.push(
            <div
                className='col-xs-6 col-sm-3 premade-themes'
                key={'premade-theme-key' + customTheme.ID}
            >
                <div
                    id={`premadeTheme${data.type?.replace(' ', '')}`}
                    className={activeClass}
                    onClick={() => updateTheme(data)}
                >
                    <label>
                        <ThemeThumbnail
                            themeKey={customTheme.ID}
                            themeName={data.type}
                            sidebarBg={data.sidebarBg}
                            sidebarText={changeOpacity(data.sidebarText, 0.48)}
                            sidebarUnreadText={data.sidebarUnreadText}
                            sidebarHeaderBg={data.sidebarHeaderBg}
                            sidebarHeaderTextColor={changeOpacity(data.sidebarHeaderTextColor, 0.48)}
                            onlineIndicator={data.onlineIndicator}
                            awayIndicator={data.awayIndicator}
                            dndIndicator={data.dndIndicator}
                            centerChannelColor={changeOpacity(data.centerChannelColor, 0.16)}
                            centerChannelBg={data.centerChannelBg}
                            newMessageSeparator={data.newMessageSeparator}
                            buttonBg={data.buttonBg}
                        />
                        <div className='theme-label'>{customTheme.Name}</div>
                    </label>
                </div>
            </div>,
        );
    });

    for (const k in Preferences.THEMES) {
        if (Preferences.THEMES.hasOwnProperty(k)) {
            if (hasAllowedThemes && allowedThemes.indexOf(k) < 0) {
                continue;
            }

            const premadeTheme: Theme = Object.assign({}, Preferences.THEMES[k as ThemeKey]);

            let activeClass = '';
            if (premadeTheme.type === theme.type) {
                activeClass = 'active';
            }

            premadeThemes.push(
                <div
                    className='col-xs-6 col-sm-3 premade-themes'
                    key={'premade-theme-key' + k}
                >
                    <div
                        id={`premadeTheme${premadeTheme.type?.replace(' ', '')}`}
                        className={activeClass}
                        onClick={() => updateTheme(premadeTheme)}
                    >
                        <label>
                            <ThemeThumbnail
                                themeKey={k}
                                themeName={premadeTheme.type}
                                sidebarBg={premadeTheme.sidebarBg}
                                sidebarText={changeOpacity(premadeTheme.sidebarText, 0.48)}
                                sidebarUnreadText={premadeTheme.sidebarUnreadText}
                                sidebarHeaderBg={premadeTheme.sidebarHeaderBg}
                                sidebarHeaderTextColor={changeOpacity(premadeTheme.sidebarHeaderTextColor, 0.48)}
                                onlineIndicator={premadeTheme.onlineIndicator}
                                awayIndicator={premadeTheme.awayIndicator}
                                dndIndicator={premadeTheme.dndIndicator}
                                centerChannelColor={changeOpacity(premadeTheme.centerChannelColor, 0.16)}
                                centerChannelBg={premadeTheme.centerChannelBg}
                                newMessageSeparator={premadeTheme.newMessageSeparator}
                                buttonBg={premadeTheme.buttonBg}
                            />
                            <div className='theme-label'>{toTitleCase(premadeTheme.type || '')}</div>
                        </label>
                    </div>
                </div>,
            );
        }
    }

    return (
        <div className='row appearance-section'>
            <div className='clearfix'>
                {premadeThemes}
            </div>
        </div>
    );
};

export default PremadeThemeChooser;
