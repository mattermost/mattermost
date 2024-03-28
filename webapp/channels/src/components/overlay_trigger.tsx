// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {OverlayTrigger as OriginalOverlayTrigger, OverlayTriggerProps} from 'react-bootstrap'; // eslint-disable-line no-restricted-imports

export type BaseOverlayTrigger = OriginalOverlayTrigger & {
    hide: () => void;
};

type Props = OverlayTriggerProps & {
    disabled?: boolean;
    className?: string;
};

/**
 * @deprecated Use (and expand when extrictly needed) WithTooltip instead
 */
const OverlayTrigger = React.forwardRef((props: Props) => {
    return <>{props.children}</>;
});

OverlayTrigger.defaultProps = {
    defaultOverlayShown: false,
    trigger: ['hover', 'focus'],
};
OverlayTrigger.displayName = 'OverlayTrigger';

export default OverlayTrigger;
