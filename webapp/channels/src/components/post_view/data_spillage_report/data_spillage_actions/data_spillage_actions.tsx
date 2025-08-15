// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import './data_spillage_actions.scss';

export default function DataSpillageAction() {
    return (
        <div
            className='DataSpillageAction'
            data-testid='data-spillage-action'
        >
            <button
                className='btn btn-danger btn-sm'
                data-testid='data-spillage-action-remove-message'
            >
                <FormattedMessage
                    id='data_spillage_report.remove_message.button_text'
                    defaultMessage='Remove message'
                />
            </button>

            <button
                className='btn btn-tertiary btn-sm'
                data-testid='data-spillage-action-keep-message'
            >
                <FormattedMessage
                    id='data_spillage_report.keep_message.button_text'
                    defaultMessage='Keep message'
                />
            </button>
        </div>
    );
}
