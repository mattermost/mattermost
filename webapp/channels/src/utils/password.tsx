// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import type {PasswordConfig} from 'mattermost-redux/selectors/entities/general';

import Constants from 'utils/constants';

export function isValidPassword(password: string, passwordConfig: PasswordConfig, intl?: IntlShape) {
    // The translation strings used by this function are defined in admin_console/password_settings
    let errorId = 'user.settings.security.passwordError';
    const telemetryErrorIds = [];
    let valid = true;
    const minimumLength = passwordConfig.minimumLength || Constants.MIN_PASSWORD_LENGTH;

    if (password.length < minimumLength || password.length > Constants.MAX_PASSWORD_LENGTH) {
        valid = false;
        telemetryErrorIds.push({field: 'password', rule: 'error_length'});
    }

    if (passwordConfig.requireLowercase) {
        if (!password.match(/[a-z]/)) {
            valid = false;
        }

        errorId += 'Lowercase';
        telemetryErrorIds.push({field: 'password', rule: 'lowercase'});
    }

    if (passwordConfig.requireUppercase) {
        if (!password.match(/[A-Z]/)) {
            valid = false;
        }

        errorId += 'Uppercase';
        telemetryErrorIds.push({field: 'password', rule: 'uppercase'});
    }

    if (passwordConfig.requireNumber) {
        if (!password.match(/[0-9]/)) {
            valid = false;
        }

        errorId += 'Number';
        telemetryErrorIds.push({field: 'password', rule: 'number'});
    }

    if (passwordConfig.requireSymbol) {
        if (!password.match(/[ !"\\#$%&'()*+,-./:;<=>?@[\]^_`|~]/)) {
            valid = false;
        }

        errorId += 'Symbol';
        telemetryErrorIds.push({field: 'password', rule: 'symbol'});
    }

    let error;
    if (!valid) {
        error = intl ? (
            intl.formatMessage(
                {
                    id: errorId,
                    defaultMessage: 'Must be {min}-{max} characters long.',
                },
                {
                    min: minimumLength,
                    max: Constants.MAX_PASSWORD_LENGTH,
                },
            )
        ) : (
            <FormattedMessage
                id={errorId}
                defaultMessage='Must be {min}-{max} characters long.'
                values={{
                    min: minimumLength,
                    max: Constants.MAX_PASSWORD_LENGTH,
                }}
            />
        );
    }

    return {valid, error, telemetryErrorIds};
}
