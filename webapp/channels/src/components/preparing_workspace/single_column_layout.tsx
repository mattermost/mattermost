// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './single_column_layout.scss';

type Props = {
    children: React.ReactNode | React.ReactNodeArray;
    beforePath?: boolean;
    afterPath?: boolean;
    style?: React.CSSProperties;
    lineDistance?: number;
    lineLeft?: number;
};

export default function SingleColumnLayout(props: Props) {
    let children = props.children;
    if (React.Children.count(props.children) > 1) {
        children = <div>{props.children}</div>;
    }

    return (
        <div
            className='SingleColumnLayout'
            style={props.style}
        >
            {children}
        </div>
    );
}
