// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    value: string;
}

const ActiveSearchBackend = ({
    value,
}: Props) => {
    return (
        <div className='form-group'>
            <label
                className='control-label col-sm-4'
            >
                <FormattedMessage
                    id='admin.database.search_backend.title'
                    defaultMessage='Active Search Backend:'
                />
            </label>
            <div className='col-sm-8'>
                <input
                    type='text'
                    className='form-control'
                    value={value}
                    disabled={true}
                />
                <div className='help-text'>
                    <FormattedMessage
                        id='admin.database.search_backend.help_text'
                        defaultMessage='Shows the currently active backend used for search. Values can be none, database, elasticsearch, bleve etc.'
                    />
                </div>
            </div>
        </div>
    );
};

export default ActiveSearchBackend;
