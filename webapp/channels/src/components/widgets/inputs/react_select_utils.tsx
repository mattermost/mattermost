// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {components} from 'react-select';
import type {GroupBase, MenuProps} from 'react-select';

export const REACT_SELECT_PORTAL_Z_INDEX = 99999999;

export function renderReactSelectMenu<Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
    props: MenuProps<Option, IsMulti, Group>,
    suppressWhenEmpty: boolean,
): React.ReactElement | null {
    if (suppressWhenEmpty && !props.selectProps.inputValue && props.options.length === 0) {
        return null;
    }

    return <components.Menu {...props}/>;
}
