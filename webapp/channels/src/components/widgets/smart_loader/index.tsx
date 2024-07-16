// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ReactNode, useEffect, useState} from 'react';

const DEFAULT_MIN_LOADER_DURATION = 1000;

type Props = {
    loading: boolean;
    children: ReactNode;
    className?: string;
    onLoaded: () => void;
}

const SmartLoader = ({loading, children, className, onLoaded}: Props) => {
    const [timeoutFinished, setTimeoutFinished] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setTimeoutFinished(true);
        }, DEFAULT_MIN_LOADER_DURATION);
    }, []);

    useEffect(() => {
        if (!loading && timeoutFinished) {
            onLoaded();
        }
    }, [loading, timeoutFinished, onLoaded]);

    return loading || !timeoutFinished ? (
        <div className={`SmartLoader ${className}`}>
            {children}
        </div>
    ) : null;
};

export default SmartLoader;
