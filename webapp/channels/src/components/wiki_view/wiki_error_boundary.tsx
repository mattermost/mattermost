// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {FallbackProps} from 'components/with_error_boundary';
import withErrorBoundary from 'components/with_error_boundary';

import './wiki_error_boundary.scss';

export function withWikiErrorBoundary<P>(component: React.ComponentType<P>) {
    return withErrorBoundary<P>(component, {
        renderFallback: ({clearError}) => {
            return (
                <div className='wiki-error-boundary'>
                    <i className='icon icon-alert-circle-outline'/>
                    <FormattedMessage
                        id='wiki.renderError.message'
                        defaultMessage='An error occurred while loading this page.'
                        tagName='p'
                    />
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
            aria-label={intl.formatMessage({id: 'wiki.renderError.retryLabel', defaultMessage: 'Retry loading this page'})}
            onClick={clearError}
        >
            <FormattedMessage
                id='wiki.renderError.retry'
                defaultMessage='Retry'
            />
        </button>
    );
}
