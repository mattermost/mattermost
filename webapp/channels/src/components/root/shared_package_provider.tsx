// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {SharedProvider} from '@mattermost/shared/context';

export interface SharedPackageProviderProps {
    children: React.ReactNode;
}

export default function SharedPackageProvider({children}: SharedPackageProviderProps) {
    return (
        <SharedProvider>
            {children}
        </SharedProvider>
    );
}
