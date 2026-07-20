// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';

import {Button, type ButtonProps} from '@mattermost/shared/components/button';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

export interface SpinnerButtonProps extends Omit<ButtonProps, 'emphasis'> {
    spinning: boolean;
    spinningText: ReactNode | MessageDescriptor;
}

const SpinnerButton = ({
    spinning = false,
    spinningText,
    children,
    disabled,
    ...otherProps
}: SpinnerButtonProps) => {
    return (
        <Button
            disabled={disabled || spinning}
            {...otherProps}
        >
            <LoadingWrapper
                loading={spinning}
                text={spinningText}
            >
                {children}
            </LoadingWrapper>
        </Button>
    );
};
export default React.memo(SpinnerButton);
