// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {popoutHelp, canPopout} from 'utils/popouts/popout_windows';

import './help_button.scss';

const HelpButton = (): JSX.Element => {
    const intl = useIntl();

    const handleClick = useCallback(() => {
        if (canPopout()) {
            popoutHelp();
        } else {
            window.open('/help', '_blank', 'noopener,noreferrer');
        }
    }, []);

    return (
        <div className='HelpButton'>
            <button
                type='button'
                className='HelpButton__link'
                onClick={handleClick}
                aria-label={intl.formatMessage({id: 'advanced_text_editor.help_link.aria', defaultMessage: 'Messaging help'})}
            >
                <FormattedMessage
                    id='advanced_text_editor.help_link'
                    defaultMessage='Help'
                />
            </button>
        </div>
    );
};

export default memo(HelpButton);
