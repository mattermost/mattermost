// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, type JSX} from 'react';

type ErrorLabelProps = {
    errorText?: string | JSX.Element;

    testId?: string;
};

const ErrorLabel = ({errorText, testId}: ErrorLabelProps) => (errorText ? (
    <div className='form-group has-error'>
        <label
            className='control-label'
            data-testid={testId ? `${testId}--text` : undefined}
        >
            {errorText}
        </label>
    </div>
) : null);

export default memo(ErrorLabel);
