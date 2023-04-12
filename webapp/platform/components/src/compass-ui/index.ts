// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export * from './components';

import ThemeProvider from './themeprovider/themeprovider';
import {createPaletteFromLegacyTheme} from './themeprovider/themes';

export {
    ThemeProvider,
    createPaletteFromLegacyTheme,
};
