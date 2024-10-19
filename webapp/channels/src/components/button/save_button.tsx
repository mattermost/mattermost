// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';
import {defineMessages} from 'react-intl';

import Button from '.';

type Props = {
    emphasis?: ComponentProps<typeof Button>['emphasis'];
    saving?: boolean;
    disabled?: ComponentProps<typeof Button>['disabled'];
    onClick?: ComponentProps<typeof Button>['onClick'];
    savingMessage?: ComponentProps<typeof Button>['label'];
    defaultMessage?: ComponentProps<typeof Button>['label'];
    pull?: ComponentProps<typeof Button>['pull'];
    trailingIcon?: ComponentProps<typeof Button>['trailingIcon'];
    size?: ComponentProps<typeof Button>['size'];
    testId?: ComponentProps<typeof Button>['testId'];
    destructive?: ComponentProps<typeof Button>['destructive'];
    fullWidth?: ComponentProps<typeof Button>['fullWidth'];
};

const messages = defineMessages({
    saving: {
        id: 'save_button.saving',
        defaultMessage: 'Saving',
    },
    save: {
        id: 'save_button.save',
        defaultMessage: 'Save',
    },
});

const SaveButton: React.FC<Props> = ({
    saving = false,
    disabled = false,
    savingMessage = messages.saving,
    defaultMessage = messages.save,
    emphasis,
    onClick,
    pull,
    trailingIcon,
    size,
    testId,
    destructive,
    fullWidth,
}) => {
    return (
        <Button
            buttonType='submit'
            testId={testId || 'saveSetting'}
            emphasis={emphasis}
            disabled={disabled}
            loading={saving}
            label={saving ? savingMessage : defaultMessage}
            onClick={onClick}
            pull={pull}
            trailingIcon={trailingIcon}
            size={size}
            destructive={destructive}
            fullWidth={fullWidth}
        />
    );
};

export default SaveButton;
