// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropsFromRedux} from './index';

// Deferred load so action/plugin modules can open dialogs without importing the
// full dialog UI graph (block_renderer → markdown → at_mention → …) at init time.
const LazyDialogRouter = React.lazy(() => import('components/dialog_router'));

type Props = Partial<PropsFromRedux> & {
    onExited?: () => void;
    triggerId?: string;
};

const LazyDialogRouterModal = (props: Props) => {
    return (
        <React.Suspense fallback={null}>
            <LazyDialogRouter {...props}/>
        </React.Suspense>
    );
};

export default LazyDialogRouterModal;
