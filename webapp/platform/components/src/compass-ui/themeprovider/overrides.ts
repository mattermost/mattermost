// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ThemeOptions} from '@mui/material/styles/createTheme';

import MuiButton from '../components/button/button.overrides';
import MuiIconButton from '../components/icon_button/icon_button.overrides';
import typographyOverrides from '../components/typography/typography.overrides';

const components: ThemeOptions['components'] = {
    MuiButton,
    MuiIconButton,
};

const overrides: ThemeOptions = {
    components,
    typography: {
        ...typographyOverrides,
        htmlFontSize: 10,
    },
};

export default overrides;
