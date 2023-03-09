// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import {useDispatch, useSelector} from 'react-redux';

import moment from 'moment';

import classNames from 'classnames';

import {submitTrueUpReview, getTrueUpReviewStatus} from 'actions/hosted_customer';
import {
    isCurrentLicenseCloud,
} from 'mattermost-redux/selectors/entities/cloud';

import {
    getSelfHostedErrors,
    getTrueUpReviewProfile as trueUpReviewProfileSelector,
    getTrueUpReviewStatus as trueUpReviewStatusSelector,
} from 'mattermost-redux/selectors/entities/hosted_customer';

import useCWSAvailabilityCheck from 'components/common/hooks/useCWSAvailabilityCheck';
import CheckMarkSvg from 'components/widgets/icons/check_mark_icon';

import './true_up_review.scss';
import {GlobalState} from '@mattermost/types/store';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {pageVisited} from 'actions/telemetry_actions';
import {DocLinks, TELEMETRY_CATEGORIES} from 'utils/constants';
import {getIsStarterLicense, getIsGovSku} from 'utils/license_utils';

const TrueUpReview: React.FC = () => {
    const dispatch = useDispatch();
    const isCloud = useSelector(isCurrentLicenseCloud);
    const isAirGapped = !useCWSAvailabilityCheck();
    const reviewProfile = useSelector(trueUpReviewProfileSelector);
    const reviewStatus = useSelector(trueUpReviewStatusSelector);
    const isSystemAdmin = useSelector(isCurrentUserSystemAdmin);
    const license = useSelector(getLicense);
    const isLicensed = license.IsLicensed === 'true';
    const isStarter = getIsStarterLicense(license);
    const isGovSku = getIsGovSku(license);

    // A license is eligible for true up if:
    // * a license exists for the customer
    // * are self-hosted (not cloud)
    // * are not on starter/free
    // * are not a government sku
    const licenseIsTrueUpEligible = isLicensed && !isCloud && !isStarter && !isGovSku;
    const telemetryEnabled = useSelector(getConfig).EnableDiagnostics === 'true';
    const trueUpReviewError = useSelector((state: GlobalState) => {
        const errors = getSelfHostedErrors(state);
        return Boolean(errors.trueUpReview);
    });

    useEffect(() => {
        if (reviewStatus.getRequestState !== 'IDLE' || !licenseIsTrueUpEligible) {
            return;
        }

        dispatch(getTrueUpReviewStatus());
    }, [dispatch, reviewStatus.getRequestState, licenseIsTrueUpEligible]);

    // Download the review profile as a base64 encoded json file when the review request is submitted.
    useEffect(() => {
        if (reviewProfile.getRequestState === 'LOADING') {
            return;
        }

        if (reviewProfile.getRequestState === 'OK' && isAirGapped && !trueUpReviewError && reviewProfile.content.length > 0) {
            // Create the bundle as a blob containing base64 encoded json data and assign it to a link element.
            const blob = new Blob([reviewProfile.content], {type: 'application/text'});
            const href = URL.createObjectURL(blob);

            const link = document.createElement('a');
            const date = moment().format('MM-DD-YYYY');
            link.href = href;
            link.download = `True Up-${license.Id}-${date}.txt`;
            document.body.appendChild(link);
            link.click();

            // Remove link and revoke object url to avoid memory leaks.
            document.body.removeChild(link);
            URL.revokeObjectURL(href);
        }
    }, [isAirGapped, reviewProfile, reviewProfile.getRequestState, trueUpReviewError]);

    const formattedDueDate = (): string => {
        if (!reviewStatus.due_date) {
            return '';
        }

        // Convert from milliseconds
        const date = new Date(reviewStatus.due_date);
        return moment(date).format('MMMM DD, YYYY');
    };

    const handleSubmitReview = () => {
        dispatch(submitTrueUpReview());
    };

    const dueDate = (
        <div className='TrueUpReview__dueDate'>
            <span>
                <FormattedMessage
                    id='admin.billing.trueUpReview.due_date'
                    defaultMessage='Due '
                />
            </span>
            <span>
                {formattedDueDate()}
            </span>
        </div>
    );

    const submitButton = (
        <button
            className={classNames('btn btn-primary TrueUpReview__submit', {'TrueUpReview__submit--error': trueUpReviewError})}
            onClick={handleSubmitReview}
        >
            {isAirGapped ?
                <FormattedMessage
                    id='admin.billing.trueUpReview.button_download'
                    defaultMessage='Download Data'
                /> :
                <FormattedMessage
                    id='admin.billing.trueUpReview.button_share'
                    defaultMessage='Share to Mattermost'
                />
            }
        </button>
    );

    const errorStatus = (
        <>
            <WarningIcon additionalClassName={'TrueUpReview__warning'}/>
            <FormattedMessage
                id='admin.billing.trueUpReview.submit_error'
                defaultMessage='There was an issue sending your True Up Review. Please try again.'
            />
            {submitButton}
        </>
    );

    const successStatus = (
        <>
            <CheckMarkSvg/>
            <FormattedMessage
                id='admin.billing.trueUpReview.submit_success'
                defaultMessage='Success!'
            />
            <FormattedMessage
                id='admin.billing.trueUpReview.submit.thanks_for_sharing'
                defaultMessage='Thanks for sharing data needed for your true-up review.'
            />
        </>
    );

    const trueUpDocsLink = (
        <a
            href={DocLinks.TRUE_UP_REVIEW}
            target='_blank'
            rel='noreferrer'
        >
            <FormattedMessage
                id='admin.billing.trueUpReview.docsLinkCTA'
                defaultMessage='Learn more about true-up.'
            />
        </a>
    );

    const reviewDetails = (
        <>
            {dueDate}
            <FormattedMessage
                id='admin.billing.trueUpReview.share_data_for_review'
                defaultMessage='Share your system statistics with Mattermost for your quarterly true-up Review. {link}'
                values={{
                    link: trueUpDocsLink,
                }}
            />
            {submitButton}
        </>
    );

    const cardContent = () => {
        if (reviewProfile.getRequestState !== 'OK' && trueUpReviewError) {
            return errorStatus;
        }

        // If we just submitted and the review status is set as complete, show the success
        // status details.
        if (reviewProfile.getRequestState === 'OK') {
            return successStatus;
        }

        // If the due date is empty we still have the default state.
        if (!reviewStatus.due_date) {
            return null;
        }

        return reviewDetails;
    };

    // Only show the true up review section if the user is an admin and we're not using a cloud instance.
    if (!licenseIsTrueUpEligible || !isSystemAdmin) {
        return null;
    }

    // Only display the review details if we are within 2 weeks of the review due date.
    const visibilityStart = moment(reviewStatus.due_date).startOf('day').subtract(30, 'days');
    if (moment().isSameOrBefore(visibilityStart)) {
        return null;
    }

    // If the review has already been submitted, don't show anything.
    if (reviewStatus.complete) {
        return null;
    }

    if (telemetryEnabled) {
        return null;
    }

    pageVisited(TELEMETRY_CATEGORIES.TRUE_UP_REVIEW, 'pageview_true_up_review');

    return (
        <div className='TrueUpReview__card'>
            <div className='TrueUpReview__cardHeader'>
                <div className='TrueUpReview__cardHeaderText'>
                    <div className='TrueUpReview__cardHeaderText-top'>
                        <FormattedMessage
                            id='admin.billing.trueUpReview.title'
                            defaultMessage='True Up Review'
                        />
                    </div>
                </div>
            </div>
            <div className='TrueUpReview__cardBody'>
                {cardContent()}
            </div>
        </div>
    );
};

export default TrueUpReview;

