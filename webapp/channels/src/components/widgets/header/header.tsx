// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {ReactNode, Fragment, HTMLAttributes} from 'react';

import './header.scss';

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
        <header
            {...attrs}
            className={classNames('Header', attrs.className)}
        >
            <div className='left'>
                <H>{heading}</H>
                {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <div className='spacer'/>
            {right}
        </header>
    );
};

export default Header;
