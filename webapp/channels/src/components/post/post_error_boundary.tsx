// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

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
                    <button
                        className='btn btn-tertiary'
                        onClick={clearError}
                    >
                        <FormattedMessage
                            id='post.renderError.tryAgain'
                            defaultMessage='Try again?'
                        />
                    </button>
                </div>
            );
        },
    });
}
