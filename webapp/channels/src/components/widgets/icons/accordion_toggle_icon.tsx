// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export default function AccordionToggleIcon(
    props: React.HTMLAttributes<HTMLSpanElement>,
) {
    return (
        <span {...props}>
            <svg
                width='30px'
                height='30px'
                viewBox='0 0 30 30'
            >
                <g
                    id='Developer-Export'
                    stroke='none'
                    strokeWidth='1'
                    fill='none'
                    fillRule='evenodd'
                >
                    <g
                        transform='translate(-995.000000, -1372.000000)'
                        id='All-Team-Members'
                    >
                        <g transform='translate(245.000000, 698.000000)'>
                            <g
                                id='Team-Administrators'
                                transform='translate(0.000000, 651.000000)'
                            >
                                <g id='accordion-header'>
                                    <g
                                        id='accordion---expanded'
                                        transform='translate(750.000000, 23.000000)'
                                    >
                                        <path
                                            d='M23.1484532,13.3124932 C23.3437659,13.1171805 23.3437659,12.7968676 23.1484532,12.6015549 L21.8515766,11.3124908 C21.6562639,11.1171781 21.3437635,11.1171781 21.1484508,11.3124908 L15.0000083,17.4609333 L8.8515659,11.3124908 C8.65625317,11.1171781 8.34375279,11.1171781 8.14844006,11.3124908 L6.85156352,12.6015549 C6.65625078,12.7968676 6.65625078,13.1171805 6.85156352,13.3124932 L14.6484454,21.1015626 C14.8437582,21.2968754 15.1562585,21.2968754 15.3515713,21.1015626 L23.1484532,13.3124932 Z'
                                            id=''
                                            fill='#979797'
                                        />
                                        <circle
                                            id='Oval-2'
                                            stroke='#989898'
                                            strokeWidth='2'
                                            cx='15'
                                            cy='15'
                                            r='14'
                                        />
                                    </g>
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        </span>
    );
}
