// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {redirectUserToDefaultTeam} from 'actions/global_actions';

import LaptopWithCheckmark from 'components/common/svg_images_components/laptop_with_checkmark_svg';
import BrandedButton from 'components/custom_branding/branded_button';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

const KeyCodes = Constants.KeyCodes;

const ButtonContainer = styled.div`
    display: flex;
    justify-content: center;
`;

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

export default class Confirm extends React.PureComponent<Props> {
    public componentDidMount(): void {
        document.body.addEventListener('keydown', this.onKeyPress);
    }

    public componentWillUnmount(): void {
        document.body.removeEventListener('keydown', this.onKeyPress);
    }

    submit = (e: KeyboardEvent | React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        redirectUserToDefaultTeam();
    };

    onKeyPress = (e: KeyboardEvent | React.FormEvent<HTMLFormElement>): void => {
        if (isKeyPressed(e as KeyboardEvent, KeyCodes.ENTER)) {
            this.submit(e);
        }
    };

    public render(): JSX.Element {
        return (
            <div className='signup-team__container mfa mfa-confirm'>
                <LaptopWithCheckmark/>
                <h1>
                    <FormattedMessage
                        id='mfa.confirmTitle'
                        defaultMessage='Multi-Factor Authentication Setup Complete'
                    />
                </h1>
                <div id='mfa'>
                    <div>
                        <form
                            onSubmit={this.submit}
                            onKeyPress={this.onKeyPress}
                            className='form-group'
                        >
                            <p>
                                <FormattedMessage
                                    id='mfa.confirm.secure'
                                    defaultMessage='Your account is now secure. Next time you sign in, you will be asked to enter a code from the Google Authenticator app on your phone.'
                                />
                            </p>
                            <ButtonContainer>
                                <BrandedButton>
                                    <button
                                        type='submit'
                                        className='btn btn-primary'
                                    >
                                        <FormattedMessage
                                            id='mfa.confirm.okay'
                                            defaultMessage='Okay'
                                        />
                                    </button>
                                </BrandedButton>
                            </ButtonContainer>
                        </form>
                    </div>
                </div>
            </div>
        );
    }
}
