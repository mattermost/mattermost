// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export default class ShieldOutlineIcon extends React.PureComponent<React.HTMLAttributes<HTMLSpanElement>> {
    render() {
        return (
            <span {...this.props}>
                <svg
                    width='100%'
                    height='100%'
                    viewBox='0 0 24 24'
                >
                    <path
                        fill='inherit'
                        d='M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1L21,5V11M12,21C15.75,20 19,15.54 19,11.22V6.3L12,3.18L5,6.3V11.22C5,15.54 8.25,20 12,21Z'
                    />
                </svg>
            </span>
        );
    }
}
