// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import './data_spillage_actions.scss';

export default function DataSpillageAction() {
    return (
        <div className='DataSpillageAction'>
            <button
                className='btn btn-danger btn-sm'
            >
                <FormattedMessage
                    id='data_spillage_report.remove_message.button_text'
                    defaultMessage='Remove message'
                />
            </button>

            <button
                className='btn btn-tertiary btn-sm'
            >
                <FormattedMessage
                    id='data_spillage_report.keep_message.button_text'
                    defaultMessage='Kepp message'
                />
            </button>
        </div>
    );
}
