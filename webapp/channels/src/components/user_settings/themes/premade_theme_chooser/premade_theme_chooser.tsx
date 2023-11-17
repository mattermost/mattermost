// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';
import {Theme, ThemeKey} from 'mattermost-redux/selectors/entities/preferences';
import {toTitleCase} from 'utils/utils';
import classNames from 'classnames';

import ThemeThumbnail from '../theme_thumbnail';

import './premade_theme_chooser.scss';
import {CheckCircleIcon} from '@mattermost/compass-icons/components';

type Props = {
    theme: Theme;
    updateTheme: (theme: Theme) => void;
    allowedThemes: string[];
    themes?: Partial<Record<ThemeKey, Theme>>;
}

const PremadeThemeChooser = ({theme, updateTheme, themes = Preferences.THEMES, allowedThemes = []}: Props) => {
    const premadeThemes = [];
    const hasAllowedThemes = allowedThemes.length > 1 || (allowedThemes[0] && allowedThemes[0].trim().length > 0);

    for (const k in themes) {
        if (themes.hasOwnProperty(k)) {
            if (hasAllowedThemes && allowedThemes.indexOf(k) < 0) {
                continue;
            }

            const premadeTheme: Theme = Object.assign({}, themes[k as ThemeKey]);
            const isActive = premadeTheme.type === theme.type;
            premadeThemes.push(
                <div
                    key={'premade-theme-key' + k}
                    id={`premadeTheme${premadeTheme.type?.replace(' ', '')}`}
                    className='premade-theme-chooser__ctr'
                    onClick={() => updateTheme(premadeTheme)}
                >
                    <div
                        className={
                            classNames('premade-theme-chooser__card',
                                {'premade-theme-chooser__card-active': isActive})
                        }
                    >
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
                            sidebarTextActiveBorder={premadeTheme.sidebarTextActiveBorder}
                        />
                    </div>
                    <div className='premade-theme-chooser__icon-label-ctr'>
                        {isActive &&
                            <CheckCircleIcon
                                size={18}
                                color={'currentColor'}
                            />
                        }
                        <span
                            className={
                                classNames('premade-theme-chooser__theme-label',
                                    {'premade-theme-chooser__theme-label-active': isActive})
                            }
                        >
                            {toTitleCase(premadeTheme.type || '')}
                        </span>
                    </div>
                </div>,
            );
        }
    }

    return (
        <div className='premade-theme-chooser'>
            {premadeThemes}
        </div>
    );
};

export default PremadeThemeChooser;
