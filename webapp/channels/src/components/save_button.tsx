// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button, type ButtonProps} from '@mattermost/shared/components/button';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

type Props = Pick<ButtonProps, 'emphasis' | 'size' | 'variant'> & {
    saving?: boolean;
    disabled?: boolean;
    id?: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    savingMessage?: React.ReactNode;
    defaultMessage?: React.ReactNode;
    extraClasses?: string;
};

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
            variant={variant}
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
