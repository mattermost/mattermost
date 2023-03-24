// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width?: number;
    height?: number;
}

export default ({width = 17, height = 16}: SvgProps) => (
    <svg
        width={width}
        height={height}
        viewBox='0 0 17 16'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <path
            fillRule='evenodd'
            clipRule='evenodd'
            d='M15.0787 8.16364C15.0787 7.6531 15.0329 7.16219 14.9478 6.69092H8.16669V9.47601H12.0416C11.8747 10.376 11.3674 11.1386 10.6049 11.6491V13.4556H12.9318C14.2932 12.2022 15.0787 10.3564 15.0787 8.16364Z'
            fill='#4285F4'
        />
        <path
            fillRule='evenodd'
            clipRule='evenodd'
            d='M8.1667 15.2C10.1107 15.2 11.7405 14.5553 12.9318 13.4556L10.6049 11.6491C9.96015 12.0811 9.13542 12.3363 8.1667 12.3363C6.29142 12.3363 4.70415 11.0698 4.13797 9.36798H1.73251V11.2334C2.91724 13.5865 5.35215 15.2 8.1667 15.2Z'
            fill='#34A853'
        />
        <path
            fillRule='evenodd'
            clipRule='evenodd'
            d='M4.13796 9.368C3.99396 8.936 3.91214 8.47454 3.91214 8C3.91214 7.52545 3.99396 7.064 4.13796 6.632V4.76654H1.73251C1.24487 5.73854 0.96669 6.83818 0.96669 8C0.96669 9.16181 1.24487 10.2615 1.73251 11.2335L4.13796 9.368Z'
            fill='#FBBC05'
        />
        <path
            fillRule='evenodd'
            clipRule='evenodd'
            d='M8.1667 3.66362C9.22379 3.66362 10.1729 4.0269 10.9191 4.74035L12.9841 2.67526C11.7372 1.51344 10.1074 0.799988 8.1667 0.799988C5.35215 0.799988 2.91724 2.41344 1.73251 4.76653L4.13797 6.63199C4.70415 4.93017 6.29142 3.66362 8.1667 3.66362Z'
            fill='#EA4335'
        />
    </svg>

);
