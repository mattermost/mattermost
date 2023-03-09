// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';
import {Theme, ThemeKey} from 'mattermost-redux/selectors/entities/preferences';

import ThemeThumbnail from '../theme_thumbnail';

import {toTitleCase} from 'utils/utils';

type Props = {
    theme: Theme;
    updateTheme: (theme: Theme) => void;
    allowedThemes: string[];
}

const PremadeThemeChooser = ({theme, updateTheme, allowedThemes = []}: Props) => {
    const premadeThemes = [];
    const hasAllowedThemes = allowedThemes.length > 1 || (allowedThemes[0] && allowedThemes[0].trim().length > 0);

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
