// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {messages} from './messages';

type Props = {
    value: string;
}

const DriverName = ({
    value,
}: Props) => {
    return (
        <div className='form-group'>
            <label
                className='control-label col-sm-4'
                htmlFor='DriverName'
            >
                <FormattedMessage {...messages.driverName}/>
            </label>
            <div className='col-sm-8'>
                <input
                    type='text'
                    className='form-control'
                    value={value}
                    disabled={true}
                />
                <div className='help-text'>
                    <FormattedMessage {...messages.driverNameDescription}/>
                </div>
            </div>
        </div>
    );
};

export default DriverName;
