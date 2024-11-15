// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {Tabs as ReactBootstrapTabs} from 'react-bootstrap';
import type {SelectCallback} from 'react-bootstrap';

import './style.scss';

type Props = {
    children?: React.ReactNode;
    id?: string;
    activeKey?: any;
    mountOnEnter?: boolean;
    unmountOnExit?: boolean;
    onSelect?: SelectCallback;
    className?: string;
}

export default function Tabs({
    children,
    id,
    activeKey,
    unmountOnExit,
    onSelect,
    className,
    mountOnEnter,
}: Props) {
    return (
        <ReactBootstrapTabs
            id={id}
            activeKey={activeKey}
            unmountOnExit={unmountOnExit}
            onSelect={onSelect}
            className={classNames('tabs', className)}
            mountOnEnter={mountOnEnter}
            autoFocus={true}
        >
            {children}
        </ReactBootstrapTabs>
    );
}
