// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {CSSTransition} from 'react-transition-group';
import {FormattedMessage, useIntl} from 'react-intl';
import debounce from 'lodash/debounce';

import QuickInput from 'components/quick_input';
import {trackEvent} from 'actions/telemetry_actions';

import {teamNameToUrl} from 'utils/url';
import Constants from 'utils/constants';

import OrganizationSVG from 'components/common/svg_images_components/organization-building_svg';

import OrganizationStatus from './organization_status';

import {Animations, mapAnimationReasonToClass, Form, PreparingWorkspacePageProps} from './steps';
import PageLine from './page_line';
import Title from './title';
import Description from './description';
import PageBody from './page_body';

import './organization.scss';

type Props = PreparingWorkspacePageProps & {
    organization: Form['organization'];
    setOrganization: (organization: Form['organization']) => void;
    className?: string;
}

const reportValidationError = debounce(() => {
    trackEvent('first_admin_setup', 'validate_organization_error');
}, 700, {leading: false});

const Organization = (props: Props) => {
    const {formatMessage} = useIntl();
    const [triedNext, setTriedNext] = useState(false);
    const validation = teamNameToUrl(props.organization || '');

    useEffect(props.onPageView, []);

    const onNext = (e?: React.KeyboardEvent | React.MouseEvent) => {
        if (e && (e as React.KeyboardEvent).key) {
            if ((e as React.KeyboardEvent).key !== Constants.KeyCodes.ENTER[0]) {
                return;
            }
        }
        if (!triedNext) {
            setTriedNext(true);
        }

        if (validation.error) {
            reportValidationError();
            return;
        }
        props.next?.();
    };

    let className = 'Organization-body';
    if (props.className) {
        className += ' ' + props.className;
    }
    return (
        <CSSTransition
            in={props.show}
            timeout={Animations.PAGE_SLIDE}
            classNames={mapAnimationReasonToClass('Organization', props.transitionDirection)}
            mountOnEnter={true}
            unmountOnExit={true}
        >
            <div className={className}>
                <div className='Organization-right-col'>
                    <div className='Organization-form-wrapper'>
                        <div className='Organization__progress-path'>
                            <OrganizationSVG/>
                            <PageLine
                                style={{
                                    marginTop: '5px',
                                    height: 'calc(50vh)',
                                }}
                                noLeft={true}
                            />
                        </div>
                        <div className='Organization__content'>
                            {props.previous}
                            <Title>
                                <FormattedMessage
                                    id={'onboarding_wizard.organization.title'}
                                    defaultMessage='What’s the name of your organization?'
                                />
                            </Title>
                            <Description>
                                <FormattedMessage
                                    id={'onboarding_wizard.organization.description'}
                                    defaultMessage='We’ll use this to help personalize your workspace.'
                                />
                            </Description>
                            <PageBody>
                                <QuickInput
                                    placeholder={
                                        formatMessage({
                                            id: 'onboarding_wizard.organization.placeholder',
                                            defaultMessage: 'Organization name',
                                        })
                                    }
                                    className='Organization__input'
                                    value={props.organization || ''}
                                    onChange={(e) => props.setOrganization(e.target.value)}
                                    onKeyUp={onNext}
                                    autoFocus={true}
                                />
                                <OrganizationStatus error={triedNext && validation.error}/>
                            </PageBody>
                            <button
                                className='primary-button'
                                data-testid='continue'
                                onClick={onNext}
                                disabled={!props.organization}
                            >
                                <FormattedMessage
                                    id={'onboarding_wizard.next'}
                                    defaultMessage='Continue'
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </CSSTransition>
    );
};
export default Organization;
