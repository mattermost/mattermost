// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {TabsProps} from 'react-bootstrap';
import {Tabs as ReactBootstrapTabs} from 'react-bootstrap';

import './style.scss';

type Props = TabsProps & {
    children?: React.ReactNode;
}

export default function Tabs(props: Props) {
    const className = classNames('tabs', props.className);
    return (
        <ReactBootstrapTabs
            {...props}
            className={className}
        >
            {props.children}
        </ReactBootstrapTabs>
    );
}
