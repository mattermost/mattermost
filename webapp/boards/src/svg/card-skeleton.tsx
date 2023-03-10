// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

type Props = {
    className?: string
}

export default function CardSkeleton(props: Props): JSX.Element {
    return (
        <span className={props.className}>
            <svg
                width='468'
                height='521'
                viewBox='0 0 468 521'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
            >
                <rect
                    width='156'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    x='172'
                    width='296'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    y='48'
                    width='156'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    x='172'
                    y='48'
                    width='296'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    y='96'
                    width='156'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    x='172'
                    y='96'
                    width='296'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    y='144'
                    width='156'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    x='172'
                    y='144'
                    width='296'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    y='192'
                    width='468'
                    height='1'
                    fill='#3D3C40'
                    fillOpacity='0.16'
                />
                <rect
                    y='209'
                    width='468'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    y='257'
                    width='468'
                    height='32'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
                <rect
                    y='305'
                    width='468'
                    height='1'
                    fill='#3D3C40'
                    fillOpacity='0.16'
                />
                <rect
                    y='322'
                    width='468'
                    height='199'
                    rx='4'
                    fill='#3F4350'
                    fillOpacity='0.08'
                />
            </svg>
        </span>
    )
}
