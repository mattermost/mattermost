// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoadingSpinner from './loading_spinner';

type Props = {
    loading?: boolean;
    text?: React.ReactNode;
    children?: React.ReactNode;
}

const LoadingWrapper = ({loading = true, text = null, children = null}: Props) => {
    return (
        <>
            {loading ? <LoadingSpinner text={text}/> : children}
        </>
    );
};

export default React.memo(LoadingWrapper);
