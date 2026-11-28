// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';

import type {SpinnerSize} from '@mattermost/compass-ui/components/spinner';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

type Props = {
    loading?: React.ReactNode;
    progress?: number;
    containerClass?: string;
    size?: SpinnerSize;

    /** The test id of the loader's container: the spinner and its progress text. */
    testId?: string;
};

const LoadingImagePreview: React.FC<Props> = ({
    loading,
    progress,
    containerClass = 'view-image__loading',
    size = '16',
    testId,
}: Props) => {
    let progressView: JSX.Element = (
        <span className='loader-percent'/>
    );

    if (progress) {
        progressView = (
            <span className='loader-percent'>
                {loading}
                {` ${progress}%`}
            </span>
        );
    }

    return (
        <div
            className={containerClass}
            data-testid={testId}
        >
            <LoadingSpinner size={size}/>
            {progressView}
        </div>
    );
};

export default LoadingImagePreview;
