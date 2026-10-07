// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import {ErrorMessage} from '@mattermost/compass-ui/components/error-message';

import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';

import {ItemStatus} from 'utils/constants';

type Props = {
    message?: string;
    custom?: CustomMessageInputType;
    className?: string;
    id?: string;
};

const InputError = (props: Props) => {
    if (props.message) {
        return (
            <ErrorMessage
                id={props.id}
                className={classNames('Input___error', props.className)}
                message={props.message}
            />
        );
    } else if (props.custom) {
        if (props.custom.type === ItemStatus.ERROR || !props.custom.type) {
            return (
                <ErrorMessage
                    id={props.id}
                    className={classNames('Input___error', props.className)}
                    message={props.custom.value}
                />
            );
        }

        return (
            <div className={`Input___customMessage Input___${props.custom.type}`}>
                <i
                    className={classNames(`icon ${props.custom.type}`, {
                        'icon-alert-outline': props.custom.type === ItemStatus.WARNING,
                        'icon-alert-circle-outline': props.custom.type === ItemStatus.ERROR,
                        'icon-information-outline': props.custom.type === ItemStatus.INFO,
                        'icon-check': props.custom.type === ItemStatus.SUCCESS,
                    })}
                />
                <span>{props.custom.value}</span>
            </div>
        );
    }
    return null;
};

export default InputError;
