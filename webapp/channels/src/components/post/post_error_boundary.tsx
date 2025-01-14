// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {FallbackProps} from 'components/with_error_boundary';
import withErrorBoundary from 'components/with_error_boundary';

export function withPostErrorBoundary<P>(component: React.ComponentType<P>) {
    return withErrorBoundary<P>(component, {
        renderFallback: ({clearError}) => {
            return (
                <div className='a11y__section post'>
                    <FormattedMessage
                        id='post.renderError.message'
                        defaultMessage='An error occurred while rendering this post.'
                        tagName='p'
                    />
                    <br/>
                    <RetryButton clearError={clearError}/>
                </div>
            );
        },
    });
}

function RetryButton({clearError}: FallbackProps) {
    const intl = useIntl();

    return (
        <button
            className='btn btn-tertiary'
            aria-label={intl.formatMessage({id: 'post.renderError.retryLabel', defaultMessage: 'Retry rendering this post'})}
            onClick={clearError}
        >
            <FormattedMessage
                id='post.renderError.retry'
                defaultMessage='Retry'
            />
        </button>
    );
}
