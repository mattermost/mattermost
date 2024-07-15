// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import throttle from 'lodash/throttle';
import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {Route, Switch, useLocation, useRouteMatch, useHistory} from 'react-router-dom';

import AlternateLinkLayout from 'components/header_footer_route/content_layouts/alternate_link';
import type {CustomizeHeaderType} from 'components/header_footer_route/header_footer_route';

import Confirm from '../confirm';
import Setup from '../setup';

const MOBILE_SCREEN_WIDTH = 1200;

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
    const {search} = useLocation();

    const onWindowResize = throttle(() => {
        setIsMobileView(window.innerWidth < MOBILE_SCREEN_WIDTH);
    }, 100);

    useEffect(() => {
        onWindowResize();
        window.addEventListener('resize', onWindowResize);
        return () => {
            window.removeEventListener('resize', onWindowResize);
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

    const updateParent = useCallback((state: {enforceMultifactorAuthentication: boolean}): void => {
        setEnforceMultifactorAuthentication(state.enforceMultifactorAuthentication);
    }, []);

    return (
        <div className='inner-wrap'>
            <div className='row content'>
                <div>
                    <div className='col-sm-12'>
                        <Switch>
                            <Route
                                path={`${match.url}/setup`}
                                render={(props) => (
                                    <Setup
                                        state={{enforceMultifactorAuthentication}}
                                        updateParent={updateParent}
                                        {...props}
                                    />
                                )}
                            />
                            <Route
                                path={`${match.url}/confirm`}
                                render={(props) => (
                                    <Confirm
                                        state={{enforceMultifactorAuthentication}}
                                        updateParent={updateParent}
                                        {...props}
                                    />
                                )}
                            />
                        </Switch>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MFAController;
