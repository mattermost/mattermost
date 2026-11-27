// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import type {OptionRemovalGuard} from './use_option_removal_guard';

type Props = {
    options: PropertyFieldOption[];
    guard: OptionRemovalGuard;
    className: string;
};

// The result of a refused or failed removal check, one line per option.
export default function OptionRemovalErrors({options, guard, className}: Props) {
    return (
        <>
            {options.map((option) => {
                if (guard.isInUse(option.id)) {
                    return (
                        <span
                            key={option.id}
                            className={className}
                            role='alert'
                            data-testid={`optionInUseError-${option.id}`}
                        >
                            <FormattedMessage
                                id='admin.global_attributes.attribute_details.options.in_use'
                                defaultMessage="This option is applied to channels and can't be deleted."
                            />
                        </span>
                    );
                }
                if (guard.hasCheckFailed(option.id)) {
                    return (
                        <span
                            key={option.id}
                            className={className}
                            role='alert'
                            data-testid={`optionRemoveCheckError-${option.id}`}
                        >
                            <FormattedMessage
                                id='admin.global_attributes.attribute_details.options.in_use_check_failed'
                                defaultMessage="Couldn't check whether channels use this option. Please try again."
                            />
                        </span>
                    );
                }
                return null;
            })}
        </>
    );
}
