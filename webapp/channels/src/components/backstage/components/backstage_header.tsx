// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import {useIntl} from 'react-intl';

import LocalizedIcon from 'components/localized_icon';

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
                    <LocalizedIcon
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
