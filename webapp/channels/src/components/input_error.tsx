// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';

import {ItemStatus} from 'utils/constants';

type Props = {
    message?: string;
    custom?: CustomMessageInputType;
}

const InputError = (props: Props) => {
    if (props.message) {
        return (
            <div className='Input___error'>
                <i className='icon icon-alert-outline'/>
                <span>{props.message}</span>
            </div>
        );
    } else if (props.custom) {
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
