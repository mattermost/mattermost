// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {Client4} from 'mattermost-redux/client';

type Props = {fileId: string; size?: number};

const CheckInImage: React.FC<Props> = ({fileId, size = 120}) => {
    const [open, setOpen] = useState(false);
    const base = Client4.getBaseRoute();
    return (
        <>
            <div className='attendance-day-card__row'>
                <button
                    type='button'
                    style={{padding: 0, border: 'none', background: 'none', cursor: 'zoom-in'}}
                    onClick={() => setOpen(true)}
                >
                    <img
                        src={`${base}/files/${fileId}/thumbnail`}
                        alt='check-in'
                        style={{maxWidth: `${size}px`, maxHeight: `${size}px`, borderRadius: '6px'}}
                    />
                </button>
            </div>
            {open && (
                <div
                    role='dialog'
                    aria-modal='true'
                    style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999}}
                    onClick={() => setOpen(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                >
                    <img
                        src={`${base}/files/${fileId}`}
                        alt='check-in'
                        style={{maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px', cursor: 'zoom-out'}}
                    />
                </div>
            )}
        </>
    );
};

export default CheckInImage;
