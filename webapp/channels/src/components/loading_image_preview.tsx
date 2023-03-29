// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

type Props = {
    loading?: string;
    progress?: number;
    containerClass?: string;
}

const LoadingImagePreview: React.FC<Props> = ({loading, progress, containerClass}: Props) => {
    let progressView: JSX.Element = (
        <span className='loader-percent'/>
    );

    if (progress) {
        progressView = (
            <span className='loader-percent'>
                {`${loading} ${progress}%`}
            </span>
        );
    }

    return (
        <div className={containerClass}>
            <LoadingSpinner/>
            {progressView}
        </div>
    );
};

LoadingImagePreview.defaultProps = {
    containerClass: 'view-image__loading',
};

export default LoadingImagePreview;
