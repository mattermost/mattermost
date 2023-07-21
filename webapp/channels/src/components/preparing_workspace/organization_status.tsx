// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';

import Constants, {DocLinks} from 'utils/constants';
import {BadUrlReasons, UrlValidationCheck} from 'utils/url';

export const TeamApiError = 'team_api_error';

const OrganizationStatus = (props: {error: (UrlValidationCheck['error'] | typeof TeamApiError | null)}): JSX.Element => {
    let children = null;
    let className = 'Organization__status';
    if (props.error) {
        className += ' Organization__status--error';
        switch (props.error) {
        case BadUrlReasons.Empty:
            children = (
                <FormattedMessage
                    id='onboarding_wizard.organization.empty'
                    defaultMessage='You must enter an organization name'
                />
            );
            break;
        case TeamApiError:
            children = (
                <FormattedMessage
                    id='onboarding_wizard.organization.team_api_error'
                    defaultMessage='There was an error, please try again.'
                />
            );
            break;
        case BadUrlReasons.Length:
            children = (
                <FormattedMessage
                    id='onboarding_wizard.organization.length'
                    defaultMessage='Organization name must be between {min} and {max} characters'
                    values={{
                        min: Constants.MIN_TEAMNAME_LENGTH,
                        max: Constants.MAX_TEAMNAME_LENGTH,
                    }}
                />
            );
            break;
        case BadUrlReasons.Reserved:
            children = (
                <FormattedMessage

                    id='onboarding_wizard.organization.reserved'
                    defaultMessage='Organization name may not <a>start with a reserved word</a>.'
                    values={{
                        a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                            <ExternalLink
                                href={DocLinks.ABOUT_TEAMS}
                                target='_blank'
                                rel='noreferrer'
                            >
                                {chunks}
                            </ExternalLink>
                        ),
                    }}
                />
            );
            break;
        default:
            children = (
                <FormattedMessage
                    id='onboarding_wizard.organization.other'
                    defaultMessage='Invalid organization name: {reason}'
                    values={{
                        reason: props.error,
                    }}
                />
            );
            break;
        }
    }
    return <div className={className}>{children}</div>;
};

export default OrganizationStatus;
