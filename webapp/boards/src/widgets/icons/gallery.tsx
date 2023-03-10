// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import './gallery.scss'

export default function GalleryIcon(): JSX.Element {
    return (
        <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='currentColor'
            xmlns='http://www.w3.org/2000/svg'
            className='GalleryIcon Icon'
        >
            <g opacity='0.8'>
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M4 4H20V16.4462L16.3273 10.3784C15.9432 9.74384 15.0262 9.7336 14.6281 10.3594L10.6479 16.6154L8.83356 14.2458C8.43849 13.7299 7.66396 13.7219 7.25832 14.2296L4 18.3077V4ZM2 4C2 2.89543 2.89543 2 4 2H20C21.1046 2 22 2.89543 22 4V20C22 21.1046 21.1046 22 20 22H4C2.89543 22 2 21.1046 2 20V4ZM8.04507 11.7014C9.06719 11.7014 9.89577 10.8728 9.89577 9.8507C9.89577 8.82859 9.06719 8 8.04507 8C7.02296 8 6.19437 8.82859 6.19437 9.8507C6.19437 10.8728 7.02296 11.7014 8.04507 11.7014Z'
                    fill='currentColor'
                />
            </g>
        </svg>

    )
}
