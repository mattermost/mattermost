// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Here we are extending the Interface defined by @types/react-bootstrap to include out own
// additional types, this soon will be not needed when we upgrade React-Bootstrap version to latest
// Until that happens this is the fix

import * as React from 'react';

import type {OverlayTriggerProps} from 'react-bootstrap';

export interface AdditionalOverlayTriggerProps extends React.ComponentPropsWithRef<typeof OverlayTriggerProps> {

    className?: string;
}

declare class OverlayTrigger extends React.Component<AdditionalOverlayTriggerProps> {}

declare module 'react-bootstrap' {
    export {OverlayTrigger};
}
