// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {useLocation, useHistory} from 'react-router-dom';

import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {trackEvent} from 'actions/telemetry_actions.jsx';

import LaptopAlertSVG from 'components/common/svg_images_components/laptop_alert_svg';
import ColumnLayout from 'components/header_footer_route/content_layouts/column';
import LoadingScreen from 'components/loading_screen';

import {clearErrors, logError} from 'mattermost-redux/actions/errors';
import {verifyUserEmail, getMe} from 'mattermost-redux/actions/users';
import {getUseCaseOnboarding} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {AnnouncementBarTypes, AnnouncementBarMessages, Constants} from 'utils/constants';
import {getRoleFromTrackFlow} from 'utils/utils';

import './do_verify_email.scss';

const enum VerifyStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILURE = 'failure',
}

const DoVerifyEmail = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
    const history = useHistory();
    const {search} = useLocation();

    const params = new URLSearchParams(search);
    const token = params.get('token') ?? '';

    const loggedIn = Boolean(useSelector(getCurrentUserId));
    const useCaseOnboarding = useSelector(getUseCaseOnboarding);

    const [verifyStatus, setVerifyStatus] = useState(VerifyStatus.PENDING);
    const [serverError, setServerError] = useState('');

    useEffect(() => {
        trackEvent('signup', 'do_verify_email', getRoleFromTrackFlow());
        verifyEmail();
    }, []);

    const handleRedirect = () => {
        if (loggedIn) {
            if (useCaseOnboarding) {
                // need info about whether admin or not,
                // and whether admin has already completed
                // first time onboarding. Instead of fetching and orchestrating that here,
                // let the default root component handle it.
                history.push('/');
                return;
            }

            redirectUserToDefaultTeam();
            return;
        }

        const newSearchParam = new URLSearchParams(search);
        newSearchParam.set('extra', Constants.SIGNIN_VERIFIED);

        history.push(`/login?${newSearchParam}`);
    };

    const verifyEmail = async () => {
        const {error} = await dispatch(verifyUserEmail(token));

        if (error) {
            setVerifyStatus(VerifyStatus.FAILURE);
            setServerError(formatMessage({
                id: 'signup_user_completed.invalid_invite.message',
                defaultMessage: 'Please speak with your Administrator to receive an invitation.',
            }));
            return;
        }

        setVerifyStatus(VerifyStatus.SUCCESS);
        await dispatch(clearErrors());

        if (!loggedIn) {
            handleRedirect();
            return;
        }

        dispatch(logError({
            message: AnnouncementBarMessages.EMAIL_VERIFIED,
            type: AnnouncementBarTypes.SUCCESS,
        } as any, true));

        trackEvent('settings', 'verify_email');

        const {error: getMeError} = await dispatch(getMe());

        if (getMeError) {
            setVerifyStatus(VerifyStatus.FAILURE);
            setServerError(formatMessage({
                id: 'signup_user_completed.failed_update_user_state',
                defaultMessage: 'Please clear your cache and try to log in.',
            }));
            return;
        }

        handleRedirect();
    };

    const handleReturnButtonOnClick = () => history.replace('/');

    return (
        verifyStatus === VerifyStatus.FAILURE ? (
            <div className='do-verify-body'>
                <div className='do-verify-body-content'>
                    <ColumnLayout
                        title={formatMessage({id: 'signup_user_completed.invalid_invite.title', defaultMessage: 'This invite link is invalid'})}
                        message={serverError}
                        SVGElement={<LaptopAlertSVG/>}
                        extraContent={(
                            <div className='do-verify-body-content-button-container'>
                                <button
                                    className='do-verify-body-content-button-return'
                                    onClick={handleReturnButtonOnClick}
                                >
                                    {formatMessage({id: 'signup_user_completed.return', defaultMessage: 'Return to log in'})}
                                </button>
                            </div>
                        )}
                    />
                </div>
            </div>
        ) : (
            <LoadingScreen/>
        )
    );
};

export default DoVerifyEmail;
