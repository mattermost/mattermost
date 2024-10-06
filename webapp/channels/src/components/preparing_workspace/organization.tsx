// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React, {useState, useEffect, useRef} from 'react';
import type {ChangeEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {CSSTransition} from 'react-transition-group';

import type {Team} from '@mattermost/types/teams';

import {getTeams} from 'mattermost-redux/actions/teams';
import {getActiveTeamsList} from 'mattermost-redux/selectors/entities/teams';

import {trackEvent} from 'actions/telemetry_actions';

import OrganizationSVG from 'components/common/svg_images_components/organization-building_svg';
import QuickInput from 'components/quick_input';

import Constants from 'utils/constants';
import {teamNameToUrl} from 'utils/url';

import Description from './description';
import OrganizationStatus, {TeamApiError} from './organization_status';
import PageBody from './page_body';
import PageLine from './page_line';
import {Animations, mapAnimationReasonToClass} from './steps';
import type {Form, PreparingWorkspacePageProps} from './steps';
import Title from './title';

import './organization.scss';

type Props = PreparingWorkspacePageProps & {
    organization: Form['organization'];
    setOrganization: (organization: Form['organization']) => void;
    className?: string;
    createTeam: (OrganizationName: string) => Promise<{error: string | null; newTeam: Team | null | undefined}>;
    updateTeam: (teamToUpdate: Team) => Promise<{error: string | null; updatedTeam: Team | null}>;
    setInviteId: (inviteId: string) => void;
}

const reportValidationError = debounce((error: string) => {
    trackEvent('first_admin_setup', 'admin_onboarding_organization_submit_fail', {error});
}, 700, {leading: false});

const Organization = (props: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [triedNext, setTriedNext] = useState(false);
    const inputRef = useRef<HTMLInputElement>();
    const validation = teamNameToUrl(props.organization || '');
    const teamApiError = useRef<typeof TeamApiError | null>(null);

    useEffect(props.onPageView, []);

    const teams = useSelector(getActiveTeamsList);
    useEffect(() => {
        if (!teams) {
            dispatch(getTeams(0, 60));
        }
    }, [teams]);

    const setApiCallError = () => {
        teamApiError.current = TeamApiError;
    };

    const updateTeamNameFromOrgName = async () => {
        if (!inputRef.current?.value) {
            return;
        }
        const name = inputRef.current?.value.trim();

        const currentTeam = teams[0];

        if (currentTeam && name && name !== currentTeam.display_name) {
            const {error} = await props.updateTeam({...currentTeam, display_name: name});
            if (error !== null) {
                setApiCallError();
            }
        }
    };

    const createTeamFromOrgName = async () => {
        if (!inputRef.current?.value) {
            return;
        }
        const name = inputRef.current?.value.trim();

        if (name) {
            const {error, newTeam} = await props.createTeam(name);
            if (error !== null || newTeam == null) {
                props.setInviteId('');
                setApiCallError();
                return;
            }
            props.setInviteId(newTeam.invite_id);
        }
    };

    const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
        props.setOrganization(e.target.value);
        teamApiError.current = null;
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
        teamApiError.current = null;

        if (!validation.error && !thereIsAlreadyATeam) {
            createTeamFromOrgName();
        } else if (!validation.error && thereIsAlreadyATeam) {
            updateTeamNameFromOrgName();
        }

        if (validation.error || teamApiError.current) {
            reportValidationError(validation.error ? validation.error : teamApiError.current! as string);
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
                                    onChange={(e) => handleOnChange(e)}
                                    onKeyUp={onNext}
                                    autoFocus={true}
                                    ref={inputRef as unknown as any}
                                />
                                {triedNext ? <OrganizationStatus error={validation.error || teamApiError.current}/> : null}
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
