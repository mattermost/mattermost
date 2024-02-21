// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';
import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import './base_setting_item.scss';

type ExtendedMessageDescriptor = MessageDescriptor & {
    values?: Record<string, PrimitiveType | FormatXMLElementFn<string, string>>;
};

export type BaseSettingItemProps = {
    title?: ExtendedMessageDescriptor;
    description?: ExtendedMessageDescriptor;
    error?: ExtendedMessageDescriptor;
};

type Props = BaseSettingItemProps & {
    content: JSX.Element;
    className?: string;
    descriptionAboveContent?: boolean;
}

function BaseSettingItem({title, description, content, className, error, descriptionAboveContent = false}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const Title = title && (
        <h4
            data-testid='mm-modal-generic-section-item__title'
            className='mm-modal-generic-section-item__title'
        >
            {formatMessage({id: title.id, defaultMessage: title.defaultMessage}, title.values)}
        </h4>
    );

    const Description = description && (
        <p
            data-testid='mm-modal-generic-section-item__description'
            className='mm-modal-generic-section-item__description'
        >
            {formatMessage({id: description.id, defaultMessage: description.defaultMessage}, description.values)}
        </p>
    );

    const Error = error && (
        <div
            data-testid='mm-modal-generic-section-item__error'
            className='mm-modal-generic-section-item__error'
        >
            <AlertCircleOutlineIcon/>
            {formatMessage({id: error.id, defaultMessage: error.defaultMessage}, error.values)}
        </div>
    );

    const getClassName = classNames('mm-modal-generic-section-item', className);

    return (
        <div className={getClassName}>
            {Title}
            {descriptionAboveContent ? Description : undefined}
            <div
                data-testid='mm-modal-generic-section-item__content'
                className='mm-modal-generic-section-item__content'
            >
                {content}
            </div>
            {descriptionAboveContent ? undefined : Description}
            {Error}
        </div>
    );
}

export default BaseSettingItem;

