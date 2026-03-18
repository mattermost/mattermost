// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import {redirectUserToDefaultTeam} from 'actions/global_actions';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

const KeyCodes = Constants.KeyCodes;

const submit = (e: KeyboardEvent | React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    redirectUserToDefaultTeam();
};

const onKeyPress = (e: React.KeyboardEvent<HTMLFormElement>| KeyboardEvent) => {
    if (isKeyPressed(e as KeyboardEvent, KeyCodes.ENTER)) {
        submit(e);
    }
};

export default function Confirm() {
    useEffect(() => {
        document.body.addEventListener('keydown', onKeyPress);

        return () => {
            document.body.removeEventListener('keydown', onKeyPress);
        };
    }, []);

    return (
        <div>
            <form
                onSubmit={submit}
                onKeyPress={onKeyPress}
                className='form-group'
            >
                <strong>
                    <FormattedMessage
                        id='mfa.confirm.complete'
                        defaultMessage='Set up complete!'
                    />
                </strong>
                <p>
                    <FormattedMessage
                        id='mfa.confirm.secure'
                        defaultMessage='Your account is now secure. Next time you sign in, you will be asked to enter a code from your authenticator app on your phone.'
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
