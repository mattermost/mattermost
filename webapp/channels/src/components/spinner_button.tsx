// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ButtonHTMLAttributes, ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
import type {ButtonEmphasis, ButtonSize as CompassButtonSize} from '@mattermost/compass-ui/components/button';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

type SharedSize = 'xs' | 'sm' | 'md' | 'lg';

const SHARED_TO_COMPASS_SIZE: Record<SharedSize, CompassButtonSize> = {
    xs: 'x-small',
    sm: 'small',
    md: 'medium',
    lg: 'large',
};

export interface SpinnerButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    children: ReactNode;
    spinning: boolean;
    spinningText: ReactNode | MessageDescriptor;
    emphasis?: ButtonEmphasis;
    size?: SharedSize | CompassButtonSize;
    destructive?: boolean;
}

function mapSize(size?: SharedSize | CompassButtonSize): CompassButtonSize | undefined {
    if (!size) {
        return undefined;
    }
    if (size in SHARED_TO_COMPASS_SIZE) {
        return SHARED_TO_COMPASS_SIZE[size as SharedSize];
    }
    return size as CompassButtonSize;
}

const SpinnerButton = ({
    spinning = false,
    spinningText,
    children,
    disabled,
    size,
    ...otherProps
}: SpinnerButtonProps) => {
    return (
        <Button
            disabled={disabled || spinning}
            size={mapSize(size)}
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
