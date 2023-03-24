// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentType} from 'react';

import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';

function withUseGetUsageDelta<T>(WrappedComponent: ComponentType<T>) {
    return (props: T) => {
        const usageDeltas = useGetUsageDeltas();

        return (
            <WrappedComponent
                usageDeltas={usageDeltas}
                {...props}
            />
        );
    };
}

export default withUseGetUsageDelta;
