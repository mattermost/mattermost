// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, memo} from 'react';
import styled from 'styled-components';

import Code from './code';
import Input from './input';
import Query from './query';
import Time from './time';

function getEmotion() {
    const emojis = [
        ':(',
        ':/',
        '(╯°□°)╯︵ ┻━┻',
        '(´･_･`)',
        '(´Д｀)',
        '¯\\_(ツ)_/¯',
    ];

    return emojis[Math.floor((Math.random() * emojis.length))];
}

const StyledFooter = styled.div`
    display: flex;
    align-items: center;
    background-color: var(--sidebar-bg);
    height: 32px;
`;

const H2 = styled.h2`
    display: flex;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.22);
    justify-content: center;
    margin: 0;
    height: ${({height}: {height: number}) => height}px;
    text-shadow: 2px 2px aquamarine;
`;

const Empty = memo(({height}: {height: number}) => {
    const emotion = useMemo(() => getEmotion(), []);

    return (
        <H2 height={height}>
            {`no data... ${emotion}`}
        </H2>
    );
});

function Footer({children}: {children: React.ReactNode}) {
    return <StyledFooter className='Footer'>{children}</StyledFooter>;
}

export {
    Footer,
    Input,
    Empty,
    Code,
    Time,
    Query,
};
