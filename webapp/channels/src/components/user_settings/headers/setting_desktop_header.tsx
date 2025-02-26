// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';

import './setting_desktop_header.scss';

interface Props {
    id?: string;
    text: ReactNode;
    info?: ReactNode;
}

export default function SettingDesktopHeader(props: Props) {
    return (
        <div className='userSettingDesktopHeader'>
            <h3
                id={props.id}
                className='tab-header'
            >
                {props.text}
            </h3>
            {props.info && <div className='userSettingDesktopHeaderInfo'>{props.info}</div>}
        </div>
    );
}
