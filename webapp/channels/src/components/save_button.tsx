// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
import type {ButtonEmphasis, ButtonSize as CompassButtonSize} from '@mattermost/compass-ui/components/button';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

type SharedSize = 'xs' | 'sm' | 'md' | 'lg';
type SharedVariant = '' | 'destructive' | 'inverted';

const SHARED_TO_COMPASS_SIZE: Record<SharedSize, CompassButtonSize> = {
    xs: 'x-small',
    sm: 'small',
    md: 'medium',
    lg: 'large',
};

type Props = {
    emphasis?: ButtonEmphasis;
    size?: SharedSize | CompassButtonSize;
    variant?: SharedVariant;
    saving?: boolean;
    disabled?: boolean;
    id?: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    savingMessage?: React.ReactNode;
    defaultMessage?: React.ReactNode;
    extraClasses?: string;
};

function mapSize(size?: SharedSize | CompassButtonSize): CompassButtonSize | undefined {
    if (!size) {
        return undefined;
    }
    if (size in SHARED_TO_COMPASS_SIZE) {
        return SHARED_TO_COMPASS_SIZE[size as SharedSize];
    }
    return size as CompassButtonSize;
}

const SaveButton: React.FC<Props> = ({
    saving = false,
    savingMessage = (
        <FormattedMessage
            id='save_button.saving'
            defaultMessage='Saving'
        />
    ),
    defaultMessage = (
        <FormattedMessage
            id='save_button.save'
            defaultMessage='Save'
        />
    ),
    emphasis,
    size,
    variant,
    extraClasses = '',
    ...props
}) => {
    return (
        <Button
            type='submit'
            data-testid='saveSetting'
            id='saveSetting'
            emphasis={emphasis}
            size={mapSize(size)}
            destructive={variant === 'destructive'}
            appearance={variant === 'inverted' ? 'inverted' : undefined}
            className={extraClasses}
            {...props}
        >
            <LoadingWrapper
                loading={saving}
                text={savingMessage}
            >
                <span>{defaultMessage}</span>
            </LoadingWrapper>
        </Button>
    );
};

export default SaveButton;
