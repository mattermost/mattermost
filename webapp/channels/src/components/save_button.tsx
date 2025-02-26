// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

type Props = {
    saving?: boolean;
    disabled?: boolean;
    id?: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    savingMessage?: React.ReactNode;
    defaultMessage?: React.ReactNode;
    btnClass?: string;
    extraClasses?: string;
};

const SaveButton: React.FC<Props> = ({
    saving = false,
    disabled = false,
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
    btnClass = '',
    extraClasses = '',
    ...props
}) => {
    let className = 'btn';
    if (!btnClass) {
        className += ' btn-primary';
    }

    if (!disabled || saving) {
        className += ' ' + btnClass;
    }

    if (extraClasses) {
        className += ' ' + extraClasses;
    }

    return (
        <button
            type='submit'
            data-testid='saveSetting'
            id='saveSetting'
            className={className}
            disabled={disabled}
            {...props}
        >
            <LoadingWrapper
                loading={saving}
                text={savingMessage}
            >
                <span>{defaultMessage}</span>
            </LoadingWrapper>
        </button>
    );
};

export default SaveButton;
