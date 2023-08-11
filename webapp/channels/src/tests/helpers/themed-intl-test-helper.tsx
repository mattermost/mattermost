// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';

import {mountWithIntl} from './intl-test-helper';

const stubValue = '#fff';
const DEFAULT_THEME: Theme = {
    type: 'custom',
    sidebarBg: stubValue,
    sidebarText: stubValue,
    sidebarUnreadText: stubValue,
    sidebarTextHoverBg: stubValue,
    sidebarTextActiveBorder: stubValue,
    sidebarTextActiveColor: stubValue,
    sidebarHeaderBg: stubValue,
    sidebarTeamBarBg: stubValue,
    sidebarHeaderTextColor: stubValue,
    onlineIndicator: stubValue,
    awayIndicator: stubValue,
    dndIndicator: stubValue,
    mentionBg: stubValue,
    mentionBj: stubValue,
    mentionColor: stubValue,
    centerChannelBg: stubValue,
    centerChannelColor: stubValue,
    newMessageSeparator: stubValue,
    linkColor: stubValue,
    buttonBg: stubValue,
    buttonColor: stubValue,
    errorTextColor: stubValue,
    mentionHighlightBg: stubValue,
    mentionHighlightLink: stubValue,
    codeTheme: stubValue,
};

export const mountWithThemedIntl = (children: React.ReactNode | React.ReactNodeArray, theme?: Theme) => {
    return mountWithIntl(
        <CompassThemeProvider
            theme={theme || DEFAULT_THEME}
        >
            {children}
        </CompassThemeProvider>,
    );
};
