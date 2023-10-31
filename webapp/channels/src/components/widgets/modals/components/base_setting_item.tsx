// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import './base_setting_item.scss';

export type BaseSettingItemProps = {
    title?: MessageDescriptor;
    description?: MessageDescriptor;
};

type Props = BaseSettingItemProps & {
    content: JSX.Element;
}

function BaseSettingItem({title, description, content}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const Title = title && (
        <h4 className='mm-modal-generic-section-item__title'>
            {formatMessage({id: title.id, defaultMessage: title.defaultMessage})}
        </h4>
    );

    const Description = description && (
        <p className='mm-modal-generic-section-item__description'>
            {formatMessage({id: description.id, defaultMessage: description.defaultMessage})}
        </p>
    );

    return (
        <div className='mm-modal-generic-section-item'>
            {Title}
            <div className='mm-modal-generic-section-item__content'>
                {content}
            </div>
            {Description}
        </div>
    );
}

export default BaseSettingItem;

