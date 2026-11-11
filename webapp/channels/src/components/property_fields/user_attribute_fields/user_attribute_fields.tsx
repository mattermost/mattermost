// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {getUserPropertyFieldLabel} from 'utils/properties';

import UserAttributeField from './user_attribute_field';
import type {UserAttributeFieldProps} from './user_attribute_field';
import {canEditUserAttribute} from './user_attribute_utils';
import type {UserAttributeValue} from './user_attribute_utils';

const messages = defineMessages({
    remove: {
        id: 'property_fields.user_attribute_fields.remove',
        defaultMessage: 'Remove {name}',
    },
});

export type UserAttributeFieldsProps = {
    fields: UserPropertyField[];
    values: Record<string, UserAttributeValue>;
    errors: Record<string, string | undefined>;
    onChange: UserAttributeFieldProps['onChange'];
    disabled?: boolean;
    canEditAdminManaged: boolean;
    onRemove?: (fieldId: string) => void;
    isRemovable?: (field: UserPropertyField) => boolean;
    testIdPrefix?: string;
};

export default function UserAttributeFields({
    fields,
    values,
    errors,
    onChange,
    disabled = false,
    canEditAdminManaged,
    onRemove,
    isRemovable,
    testIdPrefix = 'user-detail-custom-attribute',
}: UserAttributeFieldsProps) {
    const {formatMessage} = useIntl();

    return (
        <div
            className='UserAttributeFields'
            data-testid={`${testIdPrefix}-list`}
        >
            {fields.map((field) => {
                const removable = Boolean(onRemove) &&
                    canEditUserAttribute(field, {canEditAdminManaged}) &&
                    (isRemovable ? isRemovable(field) : true);

                return (
                    <UserAttributeField
                        key={field.id}
                        field={field}
                        value={values[field.id]}
                        error={errors[field.id]}
                        onChange={onChange}
                        disabled={disabled}
                        canEditAdminManaged={canEditAdminManaged}
                        testIdPrefix={testIdPrefix}
                        trailing={removable ? (
                            <button
                                type='button'
                                className='btn btn-icon btn-sm UserAttributeFields__remove'
                                aria-label={formatMessage(messages.remove, {name: getUserPropertyFieldLabel(field)})}
                                data-testid={`${testIdPrefix}-remove-${field.id}`}
                                disabled={disabled}
                                onClick={() => onRemove?.(field.id)}
                            >
                                <TrashCanOutlineIcon size={18}/>
                            </button>
                        ) : undefined}
                    />
                );
            })}
        </div>
    );
}
