// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function AttachmentIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='16px'
                height='16px'
                viewBox='0 0 16 16'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.attach', defaultMessage: 'Attachment Icon'})}
            >
                <g
                    fill='inherit'
                    fillRule='evenodd'
                >
                    <g
                        transform='translate(-1029.000000, -954.000000)'
                        fillRule='nonzero'
                        fill='inherit'
                    >
                        <g transform='translate(25.000000, 937.000000)'>
                            <g transform='translate(1004.000000, 17.000000)'>
                                <path d='M5.35,15.56 C3.98,15.56 2.61,15.039 1.567,13.997 C0.557,12.984 0,11.642 0,10.212 C0,8.783 0.557,7.44 1.566,6.429 L6.869,1.126 C8.371,-0.376 10.812,-0.375 12.314,1.125 C13.815,2.627 13.815,5.069 12.314,6.57 L7.011,11.873 C6.094,12.792 4.603,12.79 3.687,11.873 C2.771,10.958 2.771,9.467 3.687,8.551 L8.99,3.248 C9.323,2.916 9.861,2.916 10.193,3.248 C10.525,3.579 10.525,4.118 10.193,4.449 L4.89,9.752 C4.637,10.006 4.637,10.418 4.89,10.672 C5.143,10.923 5.555,10.925 5.809,10.672 L11.113,5.369 C11.952,4.53 11.952,3.166 11.113,2.327 C10.276,1.49 8.911,1.488 8.073,2.327 L2.769,7.631 C2.079,8.32 1.699,9.237 1.699,10.212 C1.699,11.188 2.079,12.104 2.768,12.794 C4.19,14.216 6.502,14.216 7.925,12.798 L7.929,12.794 C7.929,12.793 7.929,12.793 7.929,12.793 L15.355,5.369 C15.687,5.037 16.224,5.037 16.556,5.369 C16.888,5.7 16.888,6.239 16.556,6.57 L8.779,14.348 L8.761,14.332 C7.776,15.15 6.562,15.56 5.35,15.56 Z'/>
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        </span>
    );
}

