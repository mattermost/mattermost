// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Heading = {
    id: string;
    text: string;
    level: number;
};

const PageOutline = () => {
    const headings: Heading[] = [];

    const handleHeadingClick = (headingId: string) => {
        const element = document.getElementById(headingId);
        if (element) {
            element.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    };

    return (
        <div className='PageOutline'>
            <nav className='PageOutline__nav'>
                {headings.length === 0 ? (
                    <p className='PageOutline__empty'>
                        <FormattedMessage
                            id='wiki.outline.no_headings'
                            defaultMessage='No headings in this page'
                        />
                    </p>
                ) : (
                    <ul className='PageOutline__list'>
                        {headings.map((heading) => (
                            <li
                                key={heading.id}
                                className='PageOutline__item'
                                style={{paddingLeft: `${(heading.level - 1) * 12}px`}}
                            >
                                <button
                                    className='PageOutline__link'
                                    onClick={() => handleHeadingClick(heading.id)}
                                >
                                    {heading.text}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </nav>
        </div>
    );
};

export default PageOutline;
