// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export type TabProps = {
    children?: React.ReactNode;
    eventKey?: string | number;
    title?: React.ReactNode;
    unmountOnExit?: boolean;
    tabClassName?: string;
    tabIndex?: number;
};

/**
 * Marker child for `components/tabs/tabs`. Tab panels are rendered by the parent
 * `Tabs` adapter; this component does not mount react-bootstrap `Tab`.
 */
export default function Tab(_props: TabProps) {
    return null;
}
