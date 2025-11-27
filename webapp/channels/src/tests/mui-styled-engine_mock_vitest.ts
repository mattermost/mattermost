// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {vi} from 'vitest';

// https://mui.com/material-ui/guides/styled-engine/
vi.mock('@mui/styled-engine', async () => {
    const styledEngineSc = await import('@mui/styled-engine-sc');
    return styledEngineSc;
});
