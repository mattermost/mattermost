// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Toast} from '@mattermost/compass-ui/components/toast';

type Props = {
    copied: boolean;
    onDismiss: () => void;
};

/**
 * Confirms Copy call link from the Start call menu, shown under the call button.
 */
const CallLinkToast = ({copied, onDismiss}: Props) => {
    const {formatMessage} = useIntl();
    const dismissLabel = formatMessage({id: 'general_button.close', defaultMessage: 'Close'});

    if (copied) {
        return (
            <Toast
                className='DMCallButton__toast'
                type='success'
                message={
                    <FormattedMessage
                        id='start_call_menu.call_link_copied'
                        defaultMessage='Call link copied'
                        description='Toast under the call button after Copy call link put the link to join a call in the channel on the clipboard.'
                    />
                }
                dismissLabel={dismissLabel}
                onDismiss={onDismiss}
            />
        );
    }

    return (
        <Toast
            className='DMCallButton__toast'
            type='danger'
            message={
                <FormattedMessage
                    id='start_call_menu.call_link_copy_failed'
                    defaultMessage="Couldn't copy call link"
                    description='Toast under the call button when Copy call link could not put the link on the clipboard, for example because the browser blocked it.'
                />
            }
            dismissLabel={dismissLabel}
            onDismiss={onDismiss}
        />
    );
};

export default CallLinkToast;
