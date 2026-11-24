// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

type Props = {

    // Why the wrapped control is disabled; the tooltip's text.
    reason: string;
    className?: string;
    'data-testid'?: string;
    children: React.ReactNode;
};

/**
 * Shows why a disabled control is disabled. A disabled button gets no hover or
 * focus, so the tooltip sits on a focusable wrapper around it instead.
 */
export default function DisabledReasonTooltip({reason, className, 'data-testid': dataTestId, children}: Props) {
    return (
        <WithTooltip title={reason}>
            <span
                className={className}
                data-testid={dataTestId}

                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WithTooltip's useFocus only fires on its cloned child; without this the disabled control is unreachable by keyboard, so the tooltip explaining why is mouse-only
                tabIndex={0}
            >
                {children}
            </span>
        </WithTooltip>
    );
}
