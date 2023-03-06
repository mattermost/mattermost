// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Fragment, HTMLAttributes, ReactNode} from 'react';
import styled from 'styled-components';

type Props = {
    heading: ReactNode;
    level?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    subtitle?: ReactNode;
    right?: ReactNode;
};

type HeadingTag = keyof Pick<JSX.IntrinsicElements, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'>;

const Headings: Array<typeof Fragment | HeadingTag> = [Fragment, 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const Header = ({
    level = 0,
    heading,
    subtitle,
    right,
    ...attrs
}: Props & HTMLAttributes<HTMLElement>) => {
    const H = Headings[level];
    return (
        <HeaderEl {...attrs}>
            <div className='left'>
                <H>{heading}</H>
                {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <Spacer/>
            {right}
        </HeaderEl>
    );
};

const HeaderEl = styled.header`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
        margin: 0;
        line-height: 1;
    }

    h2 {
        color: rgba(var(--center-channel-color-rgb), 1);
        font-size: 16px;
        font-weight: 600;
    }

    > div p {
        margin: 6px 0 0;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-size: 12px;
        font-weight: 400;
        line-height: 16px;
    }
`;

const Spacer = styled.div`
    flex: 1;
`;

export default Header;
