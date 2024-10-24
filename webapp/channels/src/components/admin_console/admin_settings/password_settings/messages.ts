// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';
import {defineMessages} from 'react-intl';

export const messages = defineMessages({
    passwordMinLength: {id: 'user.settings.security.passwordMinLength', defaultMessage: 'Invalid minimum length, cannot show preview.'},
    password: {id: 'admin.security.password', defaultMessage: 'Password'},
    minimumLength: {id: 'admin.password.minimumLength', defaultMessage: 'Minimum Password Length:'},
    minimumLengthDescription: {id: 'admin.password.minimumLengthDescription', defaultMessage: 'Minimum number of characters required for a valid password. Must be a whole number greater than or equal to {min} and less than or equal to {max}.'},
    lowercase: {id: 'admin.password.lowercase', defaultMessage: 'At least one lowercase letter'},
    uppercase: {id: 'admin.password.uppercase', defaultMessage: 'At least one uppercase letter'},
    number: {id: 'admin.password.number', defaultMessage: 'At least one number'},
    symbol: {id: 'admin.password.symbol', defaultMessage: 'At least one symbol (e.g. "~!@#$%^&*()")'},
    preview: {id: 'admin.password.preview', defaultMessage: 'Error message preview:'},
    attemptTitle: {id: 'admin.service.attemptTitle', defaultMessage: 'Maximum Login Attempts:'},
    attemptDescription: {id: 'admin.service.attemptDescription', defaultMessage: 'Login attempts allowed before user is locked out and required to reset password via email.'},
    passwordRequirements: {id: 'passwordRequirements', defaultMessage: 'Password Requirements:'},
});

export const searchableStrings: Array<string|MessageDescriptor|[MessageDescriptor, {[key: string]: any}]> = [
    [messages.minimumLength, {max: '', min: ''}],
    [messages.minimumLengthDescription, {max: '', min: ''}],
    messages.passwordMinLength,
    messages.password,
    messages.passwordRequirements,
    messages.lowercase,
    messages.uppercase,
    messages.number,
    messages.symbol,
    messages.preview,
    messages.attemptTitle,
    messages.attemptDescription,
];
