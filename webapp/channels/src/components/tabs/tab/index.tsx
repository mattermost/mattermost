// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {TabProps} from 'react-bootstrap';
import {Tab as ReactBootstrapTab} from 'react-bootstrap';

type Props = TabProps & {
    children?: React.ReactNode;
}

export default function Tab(props: Props) {
    return (
        <ReactBootstrapTab {...props}>
            {props.children}
        </ReactBootstrapTab>
    );
}
