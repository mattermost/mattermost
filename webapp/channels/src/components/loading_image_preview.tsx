// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

type Props = {
    loading?: React.ReactNode;
    progress?: number;
    containerClass?: string;

    /** Light spinner for dark loading panels such as view-image__loading. */
    inverted?: boolean;
};

const LoadingImagePreview: React.FC<Props> = ({
    loading,
    progress,
    containerClass = 'view-image__loading',
    inverted = containerClass === 'view-image__loading',
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
            <LoadingSpinner
                size='24'
                inverted={inverted}
            />
            {progressView}
        </div>
    );
};

export default LoadingImagePreview;
