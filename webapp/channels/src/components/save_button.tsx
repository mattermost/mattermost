// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

type Props = {
    saving: boolean;
    disabled?: boolean;
    id?: string;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    savingMessage?: React.ReactNode;
    defaultMessage?: React.ReactNode;
    btnClass?: string;
    extraClasses?: string;
}

const SaveButton = ({
    disabled = false,
    btnClass = '',
    extraClasses = '',
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
    saving,
    ...restProps
}: Props) => {
    const className = classNames('btn', {
        'btn-primary': !btnClass,
        [btnClass]: !disabled || saving,
        [extraClasses]: extraClasses,
    });

    return (
        <button
            type='submit'
            data-testid='saveSetting'
            id='saveSetting'
            className={className}
            disabled={disabled}
            {...restProps}
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

export default memo(SaveButton);
