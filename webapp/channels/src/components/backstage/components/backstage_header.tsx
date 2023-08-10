// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LocalizedIcon from 'components/localized_icon';

import {t} from 'utils/i18n';

import type {ReactNode} from 'react';

type Props = {
    children?: ReactNode;
}

const BackstageHeader = ({children}: Props) => {
    const childrenElements: ReactNode[] = [];

    React.Children.forEach(children, (child, index) => {
        if (index !== 0) {
            childrenElements.push(
                <span
                    key={'divider' + index}
                    className='backstage-header__divider'
                >
                    <LocalizedIcon
                        className='fa fa-angle-right'
                        title={{id: t('generic_icons.breadcrumb'), defaultMessage: 'Breadcrumb Icon'}}
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
