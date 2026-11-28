// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';

import {Divider as CompassDivider} from '@mattermost/compass-ui/components/divider';

// A plain horizontal-rule separator for use outside MUI menus (see
// components/menu/menu_item_separator). Compass Divider has no className prop;
// put spacing classes on a parent wrapper when needed.
export default function Divider(): JSX.Element {
    return <CompassDivider />;
}
