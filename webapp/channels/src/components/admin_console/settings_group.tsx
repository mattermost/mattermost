// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    id?: string;
    show?: boolean;
    header?: React.ReactNode;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    children?: React.ReactNode;
    container?: boolean;
}

const SettingsGroup = ({
    show = true,
    header,
    title,
    subtitle,
    children,
    container = true,
}: Props) => {
    if (!show) {
        return null;
    }

    return (
        <div className={container ? 'admin-console__wrapper' : ''}>
            <div className={container ? 'admin-console__content' : ''}>
                {header ? (
                    <h4>
                        {header}
                    </h4>
                ) : (
                    <div className={'section-header'}>
                        {(title) && (
                            <div className={'section-title'}>
                                {title}
                            </div>
                        )}
                        {subtitle && (
                            <div className={'section-subtitle'}>
                                {subtitle}
                            </div>
                        )}
                    </div>
                )
                }
                {children}
            </div>
        </div>
    );
};
export default SettingsGroup;
