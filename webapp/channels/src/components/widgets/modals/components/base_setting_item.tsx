// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {PrimitiveType, FormatXMLElementFn} from 'intl-messageformat';
import React, {type JSX} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {useIntl} from 'react-intl';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import './base_setting_item.scss';

type ExtendedMessageDescriptor = MessageDescriptor & {
    values?: Record<string, PrimitiveType | FormatXMLElementFn<string, string>>;
};

export type BaseSettingItemProps = {
    title?: string;
    description?: string;
    error?: ExtendedMessageDescriptor;
    dataTestId?: string;
};

type Props = BaseSettingItemProps & {
    content: JSX.Element;
    isContentInline?: boolean;
    className?: string;
    descriptionAboveContent?: boolean;
};

function BaseSettingItem({title, description, content, className, error, descriptionAboveContent = false, isContentInline = false, dataTestId}: Props): JSX.Element {
    const {formatMessage} = useIntl();

    const titleComponent = title && (
        <h4
            data-testid={dataTestId ? `${dataTestId}.title--text` : undefined}
            className='mm-modal-generic-section-item__title'
        >
            {title}
        </h4>
    );

    const descriptionComponent = description && (
        <p
            data-testid={dataTestId ? `${dataTestId}.description--text` : undefined}
            className='mm-modal-generic-section-item__description'
        >
            {description}
        </p>
    );

    const Error = error && (
        <div
            data-testid={dataTestId ? `${dataTestId}.error--text` : undefined}
            className='mm-modal-generic-section-item__error'
        >
            <AlertCircleOutlineIcon/>
            {formatMessage({id: error.id, defaultMessage: error.defaultMessage}, error.values)}
        </div>
    );

    return (
        <div
            data-testid={dataTestId}
            className={classNames('mm-modal-generic-section-item', className)}
        >
            {titleComponent}
            {descriptionAboveContent ? descriptionComponent : undefined}
            <div
                data-testid={dataTestId ? `${dataTestId}.content` : undefined}
                className={classNames('mm-modal-generic-section-item__content', {
                    inline: isContentInline,
                })}
            >
                {content}
            </div>
            {descriptionAboveContent ? undefined : descriptionComponent}
            {Error}
        </div>
    );
}

export default BaseSettingItem;

