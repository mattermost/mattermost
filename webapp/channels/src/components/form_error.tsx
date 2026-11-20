// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export const TYPE_MODAL = 'modal';
export const TYPE_BACKSTAGE = 'backstage';

// accepts either a single error or an array of errors
type Props = {
    type?: React.ReactNode;
    error?: React.ReactNode;
    textClassName?: string;
    iconClassName?: string;
    margin?: boolean;
    errors?: React.ReactNode[];

    // Path for the message: `<testId>--text`.
    testId?: string;
};

const EMPTY_ERROR_LIST: React.ReactNode[] = [];

const FormError: React.FC<Props> = ({
    error = null,
    errors = EMPTY_ERROR_LIST,
    iconClassName,
    margin,
    textClassName,
    type,
    testId,
}) => {
    const dataTestId = testId ? `${testId}--text` : undefined;

    if (!error && errors.length === 0) {
        return null;
    }

    // look for the first truthy error to display
    let message = error;

    if (!message) {
        for (const err of errors) {
            if (err) {
                message = err;
            }
        }
    }

    if (!message) {
        return null;
    }

    if (type === TYPE_MODAL) {
        return (
            <div
                className='form-group'
                data-testid={dataTestId}
            >
                <label className='col-sm-12 has-error'>{message}</label>
            </div>
        );
    }

    if (type === TYPE_BACKSTAGE) {
        return (
            <div
                className='pull-left has-error'
                data-testid={dataTestId}
            >
                <label className='control-label'>{message}</label>
            </div>
        );
    }

    if (margin) {
        return (
            <div
                className='form-group has-error'
                data-testid={dataTestId}
            >
                <label className='control-label'>{message}</label>
            </div>
        );
    }

    return (
        <div
            className={`col-sm-12 ${textClassName || 'has-error'}`}
            data-testid={dataTestId}
        >
            <label className='control-label'>
                <i
                    className={`fa ${iconClassName || 'fa-exclamation-circle'}`}
                />{' '}
                {message}
            </label>
        </div>
    );
};

export default React.memo(FormError);
