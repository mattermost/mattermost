// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

type ErrorLabelProps = {
    errorText?: string | JSX.Element;
}

const ErrorLabel = ({errorText}: ErrorLabelProps) => (errorText ? (
    <div className='form-group has-error'>
        <label className='control-label'>{errorText}</label>
    </div>
) : null);

export default memo(ErrorLabel);
