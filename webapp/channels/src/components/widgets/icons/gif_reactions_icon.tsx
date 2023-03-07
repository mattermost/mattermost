// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export default class GifReactionsIcon extends React.PureComponent<React.HTMLAttributes<HTMLSpanElement>> {
    render() {
        return (
            <span {...this.props}>
                <svg
                    className='ic-svg ic-reactions-svg'
                    width='14px'
                    height='14px'
                    viewBox='0 0 14 14'
                    version='1.1'
                >
                    <g
                        id='Finalized-Design'
                        stroke='none'
                        fill='inherit'
                    >
                        <g
                            id='GfyCat---Gycat-Tab'
                            transform='translate(-1348.000000, -620.000000)'
                            fill='inherit'
                        >
                            <g
                                id='modal---emojis'
                                transform='translate(1147.000000, 542.000000)'
                            >
                                <g
                                    id='tabs---gfycat'
                                    transform='translate(1.000000, 68.000000)'
                                >
                                    <g
                                        id='tab---category---deselected'
                                        transform='translate(138.000000, 0.000000)'
                                    >
                                        <path
                                            d='M62,16 L62,10 L68,10 L68,16 L62,16 Z M64,12 L64,14 L66,14 L66,12 L64,12 Z M70,24 L70,18 L76,18 L76,24 L70,24 Z M72,20 L72,22 L74,22 L74,20 L72,20 Z M70,10 L76,10 L76,16 L70,16 L70,10 Z M74,14 L74,12 L72,12 L72,14 L74,14 Z M62,24 L62,18 L68,18 L68,24 L62,24 Z M64,20 L64,22 L66,22 L66,20 L64,20 Z'
                                            id='icon---categories'
                                        />
                                    </g>
                                </g>
                            </g>
                        </g>
                    </g>
                </svg>
            </span>
        );
    }
}
