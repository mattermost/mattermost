// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {Constants} from 'utils/constants';

type Props = {
    intl: IntlShape;
    firstName: string;
    lastName: string;
    authService: string;
    disabled: boolean;
    onFirstNameChange: (value: string) => void;
    onLastNameChange: (value: string) => void;
};

const UserNameFields = ({
    intl,
    firstName,
    lastName,
    authService,
    disabled,
    onFirstNameChange,
    onLastNameChange,
}: Props) => {
    const tooltipTitle = intl.formatMessage({
        id: 'admin.userManagement.userDetail.managedByProvider.title',
        defaultMessage: 'Managed by login provider',
    });
    const tooltipHint = intl.formatMessage({
        id: 'admin.userManagement.userDetail.managedByProvider.name',
        defaultMessage: 'This name is managed by the {authService} login provider and cannot be changed here.',
    }, {
        authService: authService.toUpperCase(),
    });
    const firstNamePlaceholder = intl.formatMessage({
        id: 'admin.userManagement.userDetail.firstName.input',
        defaultMessage: 'Enter first name',
    });
    const lastNamePlaceholder = intl.formatMessage({
        id: 'admin.userManagement.userDetail.lastName.input',
        defaultMessage: 'Enter last name',
    });

    return (
        <div
            className='field-row'
            data-testid='fieldRow'
        >
            <div
                className='field-column left'
                data-testid='fieldColumn'
            >
                <label>
                    <FormattedMessage
                        id='admin.userManagement.userDetail.firstName'
                        defaultMessage='First Name'
                    />
                    {authService ? (
                        <WithTooltip
                            title={tooltipTitle}
                            hint={tooltipHint}
                        >
                            <input
                                className='form-control provider-managed-input'
                                type='text'
                                value={firstName}
                                disabled={true}
                                readOnly={true}
                                maxLength={Constants.MAX_FIRSTNAME_LENGTH}
                                placeholder={firstNamePlaceholder}
                            />
                        </WithTooltip>
                    ) : (
                        <input
                            className='form-control'
                            type='text'
                            value={firstName}
                            onChange={(event) => onFirstNameChange(event.target.value)}
                            disabled={disabled}
                            maxLength={Constants.MAX_FIRSTNAME_LENGTH}
                            placeholder={firstNamePlaceholder}
                        />
                    )}
                </label>
            </div>
            <div
                className='field-column right'
                data-testid='fieldColumn'
            >
                <label>
                    <FormattedMessage
                        id='admin.userManagement.userDetail.lastName'
                        defaultMessage='Last Name'
                    />
                    {authService ? (
                        <WithTooltip
                            title={tooltipTitle}
                            hint={tooltipHint}
                        >
                            <input
                                className='form-control provider-managed-input'
                                type='text'
                                value={lastName}
                                disabled={true}
                                readOnly={true}
                                maxLength={Constants.MAX_LASTNAME_LENGTH}
                                placeholder={lastNamePlaceholder}
                            />
                        </WithTooltip>
                    ) : (
                        <input
                            className='form-control'
                            type='text'
                            value={lastName}
                            onChange={(event) => onLastNameChange(event.target.value)}
                            disabled={disabled}
                            maxLength={Constants.MAX_LASTNAME_LENGTH}
                            placeholder={lastNamePlaceholder}
                        />
                    )}
                </label>
            </div>
        </div>
    );
};

export default UserNameFields;
