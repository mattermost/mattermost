// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';

import LoadingSpinner from './loading_spinner';

type Props = {
    loading?: boolean;
    text?: MessageDescriptor | React.ReactNode;
    children?: React.ReactNode;
    legacy?: boolean;
};

const LoadingWrapper = ({loading = true, text, children, legacy}: Props) => {
    return (
        <>
            {loading ? (
                <LoadingSpinner
                    text={text}
                    legacy={legacy}
                />
            ) : children}
        </>
    );
};

export default React.memo(LoadingWrapper);
