// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ThemeOptions} from '@mui/material/styles/createTheme';

import MuiButton from '../components/button/button.overrides';
import MuiIconButton from '../components/icon-button/icon-button.overrides';
import MuiInputLabel from '../components/textfield/input-label.overrides';
import MuiOutlinedInput from '../components/textfield/outlined-input.overrides';
import typographyOverrides from '../components/typography/typography.overrides';

const components: ThemeOptions['components'] = {
    MuiButton,
    MuiIconButton,
    MuiInputLabel,
    MuiOutlinedInput,
};

const overrides: ThemeOptions = {
    components,
    typography: {
        ...typographyOverrides,
        htmlFontSize: 10,
    },
};

export default overrides;
