// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useCallback, useEffect, useState } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { Route, Switch, useLocation, useRouteMatch, useHistory } from 'react-router-dom';

import { emitUserLoggedOutEvent } from 'actions/global_actions';

import AlternateLinkLayout from 'components/header_footer_route/content_layouts/alternate_link';
import type { CustomizeHeaderType } from 'components/header_footer_route/header_footer_route';
import BackButton from 'components/common/back_button';
import LogoutIcon from 'components/widgets/icons/fa_logout_icon';

import logoImage from 'images/logo.png';

import Confirm from '../confirm';
import Setup from '../setup';

type Props = {
    children?: React.ReactNode;
    mfa: boolean;
    enableMultifactorAuthentication: boolean;
    enforceMultifactorAuthentication: boolean;
    onCustomizeHeader?: CustomizeHeaderType;
}

const MFAController = (props: Props) => {
    const [enforceMultifactorAuthentication, setEnforceMultifactorAuthentication] = useState(props.enableMultifactorAuthentication);
    const [isMobileView, setIsMobileView] = useState(false);
    const match = useRouteMatch();
    const history = useHistory();
    const intl = useIntl();
    const { search } = useLocation();

    useEffect(() => {
        document.body.classList.add('sticky');
        document.getElementById('root')!.classList.add('container-fluid');
        return () => {
            document.body.classList.remove('sticky');
            document.getElementById('root')!.classList.remove('container-fluid');
        };
    }, []);

    useEffect(() => {
        if (!props.enableMultifactorAuthentication) {
            history.push('/');
        }
    }, []);

    const handleHeaderBackButtonOnClick = useCallback(() => {
        history.goBack();
    }, [history]);

    const getAlternateLink = useCallback(() => (
        <AlternateLinkLayout
            className='signup-body-alternate-link'
            alternateMessage={intl.formatMessage({
                id: 'signup_user_completed.haveAccount',
                defaultMessage: 'Already have an account?',
            })}
            alternateLinkPath='/login'
            alternateLinkLabel={intl.formatMessage({
                id: 'signup_user_completed.signIn',
                defaultMessage: 'Log in',
            })}
        />
    ), []);

    useEffect(() => {
        if (props.onCustomizeHeader) {
            props.onCustomizeHeader({
                onBackButtonClick: handleHeaderBackButtonOnClick,
                alternateLink: isMobileView ? getAlternateLink() : undefined,
            });
        }
    }, [props.onCustomizeHeader, handleHeaderBackButtonOnClick, isMobileView, getAlternateLink, search]);

    const updateParent = useCallback((state: { enforceMultifactorAuthentication: boolean }): void => {
        setEnforceMultifactorAuthentication(state.enforceMultifactorAuthentication);
    }, []);

    const handleOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e.preventDefault();
        emitUserLoggedOutEvent('/login');
    };

    let backButton;
    if (props.mfa && props.enforceMultifactorAuthentication) {
        backButton = (
            <div className='signup-header'>
                <button
                    className='style--none color--link'
                    onClick={handleOnClick}
                >
                    <LogoutIcon />
                    <FormattedMessage
                        id='web.header.logout'
                        defaultMessage='Logout'
                    />
                </button>
            </div>
        );
    } else {
        backButton = (<BackButton />);
    }

    return (
        <div className='inner-wrap'>
            <div className='row content'>
                <div>
                    {backButton}
                    <div className='col-sm-12'>
                        <div id='mfa'>
                            <Switch>
                                <Route
                                    path={`${match.url}/setup`}
                                    render={(props) => (
                                        <Setup
                                            state={{ enforceMultifactorAuthentication }}
                                            updateParent={updateParent}
                                            {...props}
                                        />
                                    )}
                                />
                                <Route
                                    path={`${match.url}/confirm`}
                                    render={(props) => (
                                        <Confirm />
                                    )}
                                />
                            </Switch>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MFAController;
