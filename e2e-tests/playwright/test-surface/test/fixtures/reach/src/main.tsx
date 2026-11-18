import React from 'react';

import {Live} from './live';

// loaded on demand: still part of the app
const Lazy = React.lazy(() => import('./lazy'));

export function Main() {
    return (
        <div>
            <Live/>
            <Lazy/>
        </div>
    );
}
