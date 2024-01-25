// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {useIntl} from 'react-intl';

type Props = {
    children?: ReactNode;
}

const BackstageHeader = ({children}: Props) => {
    const {formatMessage} = useIntl();
    const childrenElements: ReactNode[] = [];

    React.Children.forEach(children, (child, index) => {
        if (index !== 0) {
            childrenElements.push(
                <span
                    key={'divider' + index}
                    className='backstage-header__divider'
                >
                    <i
                        className='fa fa-angle-right'
                        title={formatMessage({id: 'generic_icons.breadcrumb', defaultMessage: 'Breadcrumb Icon'})}
                    />
                </span>,
            );
        }

        childrenElements.push(child);
    });

    return (
        <div className='backstage-header'>
            <h1>
                {childrenElements}
            </h1>
        </div>
    );
};

export default BackstageHeader;
