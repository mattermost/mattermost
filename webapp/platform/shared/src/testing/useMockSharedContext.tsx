// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';

import {SharedProvider, type SharedProviderProps} from '../context/context';

export function useMockSharedContext({
}: Partial<Omit<SharedProviderProps, 'children'>>) {
    const propsWithOverrides = useMemo(() => {
        return {
        };
    }, []);

    const SharedContextProvider = useCallback(({children}: Pick<SharedProviderProps, 'children'>) => {
        return (
            <SharedProvider {...propsWithOverrides}>
                {children}
            </SharedProvider>
        );
    }, [propsWithOverrides]);

    return {SharedContextProvider};
}
