// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {messages} from './messages';

type Props = {
    value: string;
}

const DataSource = ({
    value,
}: Props) => {
    const dataSource = '**********' + value.substring(value.indexOf('@'));
    return (
        <div className='form-group'>
            <label
                className='control-label col-sm-4'
                htmlFor='DataSource'
            >
                <FormattedMessage {...messages.dataSource}/>
            </label>
            <div className='col-sm-8'>
                <input
                    type='text'
                    className='form-control'
                    value={dataSource}
                    disabled={true}
                />
                <div className='help-text'>
                    <FormattedMessage {...messages.dataSourceDescription}/>
                </div>
            </div>
        </div>
    );
};

export default DataSource;
