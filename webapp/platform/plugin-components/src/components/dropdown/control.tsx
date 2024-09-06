// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ControlProps} from 'react-select';
import {components} from 'react-select';

import type {DropdownOption} from 'components/dropdown/dropdown';
import Icon from 'components/icon/icon';

const Control = ({children, ...rest}: ControlProps<DropdownOption>) => {
    return (
        <components.Control
            {...rest}
        >
            <Icon icon='clock-outline'/>
            {children}
        </components.Control>
    );
};

export default Control;
