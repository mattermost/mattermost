// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useRef} from 'react';
import {CSSTransition} from 'react-transition-group';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import debounce from 'lodash/debounce';

import OrganizationSVG from 'components/common/svg_images_components/organization-building_svg';
import QuickInput from 'components/quick_input';

import {trackEvent} from 'actions/telemetry_actions';

import {getTeams} from 'mattermost-redux/actions/teams';
import {getActiveTeamsList} from 'mattermost-redux/selectors/entities/teams';

import {teamNameToUrl} from 'utils/url';
import Constants from 'utils/constants';

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
    createTeam?: any;
    setInviteId: (inviteId: string) => void;
    isSelfHosted: boolean;
}

const reportValidationError = debounce(() => {
    trackEvent('first_admin_setup', 'validate_organization_error');
}, 700, {leading: false});

const Organization = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [triedNext, setTriedNext] = useState(false);
    const inputRef = useRef<HTMLInputElement>();
    const validation = teamNameToUrl(props.organization || '');

    useEffect(props.onPageView, []);

    const teams = useSelector(getActiveTeamsList);
    useEffect(() => {
        if (!teams) {
            dispatch(getTeams(0, 10000));
        }
    }, [teams]);

    const updateTeamNameFromOrgName = async () => {
        if (!inputRef.current?.value) {
            return;
        }
        const name = inputRef.current?.value.trim();

        console.log('>>> update orgname', {name});

        // if (name) {
        //     const {error, newTeam} = await props.createTeam(name);
        //     if (error !== null) {
        //         props.setInviteId('');
        //         return;
        //     }
        //     props.setInviteId(newTeam.invite_id);
        // }
    };

    const createTeamFromOrgName = async () => {
        if (!inputRef.current?.value) {
            return;
        }
        const name = inputRef.current?.value.trim();

        console.log('>>> create orgname', {name});

        if (name) {
            const {error, newTeam} = await props.createTeam(name);
            if (error !== null) {
                props.setInviteId('');
                return;
            }
            props.setInviteId(newTeam.invite_id);
        }
    };

    const onNext = (e?: React.KeyboardEvent | React.MouseEvent) => {
        if (e && (e as React.KeyboardEvent).key) {
            if ((e as React.KeyboardEvent).key !== Constants.KeyCodes.ENTER[0]) {
                return;
            }
        }

        if (!triedNext) {
            setTriedNext(true);
        }

        // if there is already a team, maybe because a page reload, then just update the teamname
        const thereIsAlreadyATeam = teams.length > 0;
        if (!triedNext && !thereIsAlreadyATeam && props.isSelfHosted) {
            createTeamFromOrgName();
        } else if ((triedNext || thereIsAlreadyATeam) && props.isSelfHosted) {
            updateTeamNameFromOrgName();
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
                                    ref={inputRef as unknown as any}
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
