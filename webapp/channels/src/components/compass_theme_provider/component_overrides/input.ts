// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ComponentsProps } from '@mui/material';

const componentName = 'MuiInput';

const inputDefaultProps: ComponentsProps[typeof componentName] = {
    disableUnderline: true,
};

const overrides = {
    defaultProps: inputDefaultProps,
};

export default overrides;