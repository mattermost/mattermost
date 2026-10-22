// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import './report_notice.scss';

type Props = {
    variant: 'info' | 'success' | 'warning';
    icon: React.ReactNode;
    title: React.ReactNode;
    body: React.ReactNode;
    testId?: string;
};

export default function ReportNotice({variant, icon, title, body, testId}: Props) {
    return (
        <div
            className={classNames('ReportNotice', `ReportNotice--${variant}`)}
            data-testid={testId}
        >
            <div className='ReportNotice__icon'>{icon}</div>
            <div className='ReportNotice__body'>
                <div className='ReportNotice__title'>{title}</div>
                <div className='ReportNotice__text'>{body}</div>
            </div>
        </div>
    );
}
