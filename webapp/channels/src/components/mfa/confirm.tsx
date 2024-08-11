// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import {redirectUserToDefaultTeam} from 'actions/global_actions';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

const KeyCodes = Constants.KeyCodes;

type MFAControllerState = {
    enforceMultifactorAuthentication: boolean;
};

type Props = {

    /*
     * Object containing enforceMultifactorAuthentication
     */
    state: MFAControllerState;

    /*
     * Function that updates parent component with state props
     */
    updateParent: (state: MFAControllerState) => void;
}

export default function Confirm({state, updateParent}: Props) {
    const submit = (e: KeyboardEvent | React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        redirectUserToDefaultTeam();
    };

    const onKeyPress = useCallback((e: KeyboardEvent) => {
        if (isKeyPressed(e, KeyCodes.ENTER)) {
            submit(e);
        }
    }, [submit]);

    useEffect(() => {
        document.body.addEventListener('keydown', onKeyPress);

        return () => {
            document.body.removeEventListener('keydown', onKeyPress);
        };
    }, [onKeyPress]);

    return (
        <div>
            <form
                onSubmit={submit}
                className='form-group'
            >
                <p>
                    <FormattedMarkdownMessage
                        id='mfa.confirm.complete'
                        defaultMessage='**Set up complete!**'
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='mfa.confirm.secure'
                        defaultMessage='Your account is now secure. Next time you sign in, you will be asked to enter a code from the Google Authenticator app on your phone.'
                    />
                </p>
                <button
                    type='submit'
                    className='btn btn-primary'
                >
                    <FormattedMessage
                        id='mfa.confirm.okay'
                        defaultMessage='Okay'
                    />
                </button>
            </form>
        </div>
    );
}
