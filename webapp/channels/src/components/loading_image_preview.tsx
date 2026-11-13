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
};

const LoadingImagePreview: React.FC<Props> = ({
    loading,
    progress,
    containerClass = 'view-image__loading',
    size = '16',
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
        <div className={containerClass}>
            <LoadingSpinner size={size}/>
            {progressView}
        </div>
    );
};

export default LoadingImagePreview;
