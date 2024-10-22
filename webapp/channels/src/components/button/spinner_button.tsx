// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import Button from '.';

type Props = {
    spinning?: boolean;
    spinningText: ComponentProps<typeof Button>['label'];
    idleText: ComponentProps<typeof Button>['label'];
    onClick?: ComponentProps<typeof Button>['onClick'];
    emphasis?: ComponentProps<typeof Button>['emphasis'];
    buttonType?: ComponentProps<typeof Button>['buttonType'];
    autoFocus?: ComponentProps<typeof Button>['autoFocus'];
    testId?: string;
}

const SpinnerButton = ({
    spinning = false,
    spinningText,
    idleText,
    onClick,
    emphasis,
    testId,
    buttonType,
    autoFocus,
}: Props) => {
    return (
        <Button
            loading={spinning}
            disabled={spinning}
            label={spinning ? spinningText : idleText}
            onClick={onClick}
            emphasis={emphasis}
            testId={testId}
            buttonType={buttonType}
            autoFocus={autoFocus}
        />
    );
};

export default React.memo(SpinnerButton);
