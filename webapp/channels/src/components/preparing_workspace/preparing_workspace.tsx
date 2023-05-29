// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect, useRef, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {RouterProps} from 'react-router-dom';
import {FormattedMessage, useIntl} from 'react-intl';

import {GeneralTypes} from 'mattermost-redux/action_types';
import {General} from 'mattermost-redux/constants';
import {sendEmailInvitesToTeamGracefully} from 'mattermost-redux/actions/teams';
import {getFirstAdminSetupComplete as getFirstAdminSetupCompleteAction} from 'mattermost-redux/actions/general';
import {ActionResult} from 'mattermost-redux/types/actions';
import {Team} from '@mattermost/types/teams';
import {getIsOnboardingFlowEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {isFirstAdmin} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeam, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {getFirstAdminSetupComplete, getConfig, getLicense, getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {Client4} from 'mattermost-redux/client';

import {CategoryOther} from '@mattermost/types/work_templates';

import Constants from 'utils/constants';
import {getSiteURL, teamNameToUrl} from 'utils/url';
import {makeNewTeam} from 'utils/team_utils';
import {GlobalState} from 'types/store';

import {pageVisited, trackEvent} from 'actions/telemetry_actions';

import LogoSvg from 'components/common/svg_images_components/logo_dark_blue_svg';

import {
    WizardSteps,
    WizardStep,
    Animations,
    AnimationReason,
    Form,
    emptyForm,
    mapStepToNextName,
    mapStepToSkipName,
    mapStepToPageView,
    mapStepToSubmitFail,
    PLUGIN_NAME_TO_ID_MAP,
    mapStepToPrevious,
} from './steps';

import Organization from './organization';
import Roles from './roles';
import RolesIllustration from './roles_illustration';
import Plugins from './plugins';
import Progress from './progress';
import InviteMembers from './invite_members';
import InviteMembersIllustration from './invite_members_illustration';
import LaunchingWorkspace, {START_TRANSITIONING_OUT} from './launching_workspace';

import './preparing_workspace.scss';

const SubmissionStates = {
    Presubmit: 'Presubmit',
    UserRequested: 'UserRequested',
    Submitting: 'Submitting',
    SubmitFail: 'SubmitFail',
} as const;

type SubmissionState = typeof SubmissionStates[keyof typeof SubmissionStates];

// We want an apparent total wait of at least two seconds
// START_TRANSITIONING_OUT is how long the other side of the transitioning screen
const WAIT_FOR_REDIRECT_TIME = 2000 - START_TRANSITIONING_OUT;

export type Actions = {
    createTeam: (team: Team) => ActionResult;
    updateTeam: (team: Team) => ActionResult;
    checkIfTeamExists: (teamName: string) => ActionResult;
    getProfiles: (page: number, perPage: number, options: Record<string, any>) => ActionResult;
}

type Props = RouterProps & {
    handleForm(form: Form): void;
    background?: JSX.Element | string;
    actions: Actions;
}

function makeOnPageView(step: WizardStep) {
    return function onPageViewInner() {
        pageVisited('first_admin_setup', mapStepToPageView(step));
    };
}

function makeSubmitFail(step: WizardStep) {
    return function onPageViewInner() {
        trackEvent('first_admin_setup', mapStepToSubmitFail(step));
    };
}

const trackSubmitFail = {
    [WizardSteps.Organization]: makeSubmitFail(WizardSteps.Organization),
    [WizardSteps.Roles]: makeSubmitFail(WizardSteps.Roles),
    [WizardSteps.Plugins]: makeSubmitFail(WizardSteps.Plugins),
    [WizardSteps.InviteMembers]: makeSubmitFail(WizardSteps.InviteMembers),
    [WizardSteps.LaunchingWorkspace]: makeSubmitFail(WizardSteps.LaunchingWorkspace),
};

const onPageViews = {
    [WizardSteps.Organization]: makeOnPageView(WizardSteps.Organization),
    [WizardSteps.Roles]: makeOnPageView(WizardSteps.Roles),
    [WizardSteps.Plugins]: makeOnPageView(WizardSteps.Plugins),
    [WizardSteps.InviteMembers]: makeOnPageView(WizardSteps.InviteMembers),
    [WizardSteps.LaunchingWorkspace]: makeOnPageView(WizardSteps.LaunchingWorkspace),
};

const PreparingWorkspace = (props: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const genericSubmitError = intl.formatMessage({
        id: 'onboarding_wizard.submit_error.generic',
        defaultMessage: 'Something went wrong. Please try again.',
    });
    const isUserFirstAdmin = useSelector(isFirstAdmin);
    const onboardingFlowEnabled = useSelector(getIsOnboardingFlowEnabled);
    const isWorkTemplateEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'WorkTemplate') === 'true');

    const currentTeam = useSelector(getCurrentTeam);
    const myTeams = useSelector(getMyTeams);

    // In cloud instances created from portal,
    // new admin user has a team in myTeams but not in currentTeam.
    const team = currentTeam || myTeams?.[0];

    const config = useSelector(getConfig);
    const pluginsEnabled = config.PluginsEnabled === 'true';
    const showOnMountTimeout = useRef<NodeJS.Timeout>();
    const configSiteUrl = config.SiteURL;
    const isConfigSiteUrlDefault = Boolean(config.SiteURL && config.SiteURL === Constants.DEFAULT_SITE_URL);
    const isSelfHosted = useSelector(getLicense).Cloud !== 'true';

    const stepOrder = [
        isSelfHosted && WizardSteps.Organization,
        isWorkTemplateEnabled && WizardSteps.Roles,
        pluginsEnabled && WizardSteps.Plugins,
        WizardSteps.InviteMembers,
        WizardSteps.LaunchingWorkspace,
    ].filter((x) => Boolean(x)) as WizardStep[];

    // first steporder that is not false
    const firstShowablePage = stepOrder[0];

    const firstAdminSetupComplete = useSelector(getFirstAdminSetupComplete);

    const [[mostRecentStep, currentStep], setStepHistory] = useState<[WizardStep, WizardStep]>([stepOrder[0], stepOrder[0]]);
    const [submissionState, setSubmissionState] = useState<SubmissionState>(SubmissionStates.Presubmit);
    const browserSiteUrl = useMemo(getSiteURL, []);
    const [form, setForm] = useState({
        ...emptyForm,
    });

    useEffect(() => {
        if (!pluginsEnabled) {
            if (!form.plugins.skipped) {
                setForm({
                    ...form,
                    plugins: {
                        skipped: false,
                    },
                });
            }
            if (currentStep === WizardSteps.Plugins) {
                const mostRecentStepIndex = stepOrder.indexOf(mostRecentStep);
                setStepHistory([mostRecentStep, stepOrder[Math.max(mostRecentStepIndex - 1, 0)]]);
            }
        }
    }, [pluginsEnabled, currentStep, mostRecentStep]);

    const [showFirstPage, setShowFirstPage] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        showOnMountTimeout.current = setTimeout(() => setShowFirstPage(true), 40);
        props.actions.getProfiles(0, General.PROFILE_CHUNK_SIZE, {roles: General.SYSTEM_ADMIN_ROLE});
        dispatch(getFirstAdminSetupCompleteAction());
        document.body.classList.add('admin-onboarding');
        return () => {
            document.body.classList.remove('admin-onboarding');
            if (showOnMountTimeout.current) {
                clearTimeout(showOnMountTimeout.current);
            }
        };
    }, []);

    const shouldShowPage = (step: WizardStep) => {
        if (currentStep !== step) {
            return false;
        }
        const isFirstPage = stepOrder.indexOf(step) === 0;
        if (isFirstPage) {
            return showFirstPage;
        }
        return true;
    };
    const makeNext = useCallback((currentStep: WizardStep, skip?: boolean) => {
        return function innerMakeNext(trackingProps?: Record<string, any>) {
            const stepIndex = stepOrder.indexOf(currentStep);
            if (stepIndex === -1 || stepIndex >= stepOrder.length) {
                return;
            }
            setStepHistory([currentStep, stepOrder[stepIndex + 1]]);
            setSubmitError(null);

            const progressName = (skip ? mapStepToSkipName : mapStepToNextName)(currentStep);
            trackEvent('first_admin_setup', progressName, trackingProps);
        };
    }, [stepOrder]);

    const redirectWithError = useCallback((redirectTo: WizardStep, error: string) => {
        setStepHistory([WizardSteps.LaunchingWorkspace, redirectTo]);
        setSubmissionState(SubmissionStates.SubmitFail);
        setSubmitError(error);
        trackSubmitFail[redirectTo]();
    }, []);

    const createTeam = async (OrganizationName: string): Promise<{error: string | null; newTeam: Team | null}> => {
        const data = await props.actions.createTeam(makeNewTeam(OrganizationName, teamNameToUrl(OrganizationName || '').url));
        if (data.error) {
            return {error: genericSubmitError, newTeam: null};
        }
        return {error: null, newTeam: data.data};
    };

    const updateTeam = async (teamToUpdate: Team): Promise<{error: string | null; updatedTeam: Team | null}> => {
        const data = await props.actions.updateTeam(teamToUpdate);
        if (data.error) {
            return {error: genericSubmitError, updatedTeam: null};
        }
        return {error: null, updatedTeam: data.data};
    };

    const sendForm = async () => {
        const sendFormStart = Date.now();
        setSubmissionState(SubmissionStates.Submitting);

        if (!form.teamMembers.skipped && !isConfigSiteUrlDefault && !isSelfHosted) {
            try {
                const inviteResult = await dispatch(sendEmailInvitesToTeamGracefully(team.id, form.teamMembers.invites));
                if ((inviteResult as ActionResult).error) {
                    redirectWithError(WizardSteps.InviteMembers, genericSubmitError);
                    return;
                }
            } catch (e) {
                redirectWithError(WizardSteps.InviteMembers, genericSubmitError);
                return;
            }
        }

        // send plugins
        const {skipped: skippedPlugins, ...pluginChoices} = form.plugins;
        let pluginsToSetup: string[] = [];

        if (!skippedPlugins) {
            pluginsToSetup = Object.entries(pluginChoices).reduce(
                (acc: string[], [k, v]): string[] => (v ? [...acc, PLUGIN_NAME_TO_ID_MAP[k as keyof Omit<Form['plugins'], 'skipped'>]] : acc), [],
            );
        }

        // This endpoint sets setup complete state, so we need to make this request
        // even if admin skipped submitting plugins.
        const completeSetupRequest = {
            organization: form.organization,
            role: form.role === CategoryOther ? form.roleOther : form.role,
            install_plugins: pluginsToSetup,
        };

        try {
            await Client4.completeSetup(completeSetupRequest);
            dispatch({type: GeneralTypes.FIRST_ADMIN_COMPLETE_SETUP_RECEIVED, data: true});
        } catch (e) {
            redirectWithError(WizardSteps.Plugins, genericSubmitError);
            return;
        }

        const goToChannels = () => {
            dispatch({type: GeneralTypes.SHOW_LAUNCHING_WORKSPACE, open: true});
            props.history.push(`/${team.name}/channels${Constants.DEFAULT_CHANNEL}`);
            trackEvent('first_admin_setup', 'admin_setup_complete');
        };

        const sendFormEnd = Date.now();
        const timeToWait = WAIT_FOR_REDIRECT_TIME - (sendFormEnd - sendFormStart);

        if (timeToWait > 0) {
            setTimeout(goToChannels, timeToWait);
        } else {
            goToChannels();
        }
    };

    useEffect(() => {
        if (submissionState !== SubmissionStates.UserRequested) {
            return;
        }
        sendForm();
    }, [submissionState]);

    const adminRevisitedPage = firstAdminSetupComplete && submissionState === SubmissionStates.Presubmit;
    const shouldRedirect = !isUserFirstAdmin || adminRevisitedPage || !onboardingFlowEnabled;

    useEffect(() => {
        if (shouldRedirect) {
            props.history.push('/');
        }
    }, [shouldRedirect]);

    const getTransitionDirection = (step: WizardStep): AnimationReason => {
        const stepIndex = stepOrder.indexOf(step);
        const currentStepIndex = stepOrder.indexOf(currentStep);
        const mostRecentStepIndex = stepOrder.indexOf(mostRecentStep);
        if (stepIndex === -1 || currentStepIndex === -1 || mostRecentStepIndex === -1) {
            return Animations.Reasons.EnterFromBefore;
        }
        if (currentStep === step) {
            return currentStepIndex >= mostRecentStepIndex ? Animations.Reasons.EnterFromBefore : Animations.Reasons.EnterFromAfter;
        }
        return stepIndex > currentStepIndex ? Animations.Reasons.ExitToBefore : Animations.Reasons.ExitToAfter;
    };

    const goPrevious = useCallback((e?: React.KeyboardEvent | React.MouseEvent) => {
        if (e && (e as React.KeyboardEvent).key) {
            const key = (e as React.KeyboardEvent).key;
            if (key !== Constants.KeyCodes.ENTER[0] && key !== Constants.KeyCodes.SPACE[0]) {
                return;
            }
        }
        if (submissionState !== SubmissionStates.Presubmit && submissionState !== SubmissionStates.SubmitFail) {
            return;
        }
        const stepIndex = stepOrder.indexOf(currentStep);
        if (stepIndex <= 0) {
            return;
        }
        trackEvent('first_admin_setup', mapStepToPrevious(currentStep));
        setStepHistory([currentStep, stepOrder[stepIndex - 1]]);
    }, [currentStep]);

    const skipPlugins = useCallback((skipped: boolean) => {
        if (skipped === form.plugins.skipped) {
            return;
        }
        setForm({
            ...form,
            plugins: {
                ...form.plugins,
                skipped,
            },
        });
    }, [form]);

    const skipTeamMembers = useCallback((skipped: boolean) => {
        if (skipped === form.teamMembers.skipped) {
            return;
        }
        setForm({
            ...form,
            teamMembers: {
                ...form.teamMembers,
                skipped,
            },
        });
    }, [form]);

    const getInviteMembersAnimationClass = useCallback(() => {
        if (currentStep === WizardSteps.InviteMembers) {
            return 'enter';
        } else if (mostRecentStep === WizardSteps.InviteMembers) {
            return 'exit';
        }
        return '';
    }, [currentStep]);

    const getRolesAnimationClass = useCallback(() => {
        if (currentStep === WizardSteps.Roles) {
            return 'enter';
        } else if (mostRecentStep === WizardSteps.Roles) {
            return 'exit';
        }
        return '';
    }, [currentStep]);

    let previous: React.ReactNode = (
        <div
            onClick={goPrevious}
            onKeyUp={goPrevious}
            tabIndex={0}
            className='PreparingWorkspace__previous'
        >
            <i className='icon-chevron-up'/>
            <FormattedMessage
                id={'onboarding_wizard.previous'}
                defaultMessage='Previous'
            />
        </div>
    );
    if (currentStep === firstShowablePage) {
        previous = null;
    }

    return (
        <div className='PreparingWorkspace PreparingWorkspaceContainer'>
            {submissionState === SubmissionStates.SubmitFail && submitError && (
                <div className='PreparingWorkspace__submit-error'>
                    <i className='icon icon-alert-outline'/>
                    <span className='PreparingWorkspace__submit-error-message'>{submitError}</span>
                    <i
                        className='icon icon-close'
                        onClick={() => setSubmitError(null)}
                    />
                </div>
            )}
            {props.background}
            <div className='PreparingWorkspace__logo'>
                <LogoSvg/>
            </div>
            <Progress
                step={currentStep}
                stepOrder={stepOrder}
                transitionSpeed={Animations.PAGE_SLIDE}
            />
            <div className='PreparingWorkspacePageContainer'>
                <Organization
                    onPageView={onPageViews[WizardSteps.Organization]}
                    show={shouldShowPage(WizardSteps.Organization)}
                    next={makeNext(WizardSteps.Organization)}
                    transitionDirection={getTransitionDirection(WizardSteps.Organization)}
                    organization={form.organization || ''}
                    setOrganization={(organization: Form['organization']) => {
                        setForm({
                            ...form,
                            organization,
                        });
                    }}
                    setInviteId={(inviteId: string) => {
                        setForm({
                            ...form,
                            teamMembers: {
                                ...form.teamMembers,
                                inviteId,
                            },
                        });
                    }}
                    className='child-page'
                    createTeam={createTeam}
                    updateTeam={updateTeam}
                />

                <Roles
                    onPageView={onPageViews[WizardSteps.Roles]}
                    previous={previous}
                    next={() => {
                        makeNext(WizardSteps.Roles)({
                            role: form.role,
                            roleOther: form.roleOther,
                        });
                    }}
                    quickNext={(role: string) => {
                        setForm({
                            ...form,
                            role,
                            roleOther: '',
                        });
                        makeNext(WizardSteps.Roles)({
                            role,
                            roleOther: '',
                        });
                    }}
                    skip={() => {
                        setForm({
                            ...form,
                            role: '',
                            roleOther: '',
                        });
                        makeNext(WizardSteps.Roles, true)();
                    }}
                    transitionDirection={getTransitionDirection(WizardSteps.Roles)}
                    show={shouldShowPage(WizardSteps.Roles)}
                    role={form.role}
                    roleOther={form.roleOther}
                    setRole={(role: Form['role'], roleOther: Form['roleOther']) => {
                        setForm({
                            ...form,
                            role,
                            roleOther,
                        });
                    }}
                    className='child-page'
                />

                <Plugins
                    isSelfHosted={isSelfHosted}
                    onPageView={onPageViews[WizardSteps.Plugins]}
                    previous={previous}
                    next={() => {
                        const pluginChoices = {...form.plugins};
                        delete pluginChoices.skipped;
                        makeNext(WizardSteps.Plugins)(pluginChoices);
                        skipPlugins(false);
                    }}
                    skip={() => {
                        makeNext(WizardSteps.Plugins, true)();
                        skipPlugins(true);
                    }}
                    options={form.plugins}
                    setOption={(option: keyof Form['plugins']) => {
                        setForm({
                            ...form,
                            plugins: {
                                ...form.plugins,
                                [option]: !form.plugins[option],
                            },
                        });
                    }}
                    show={shouldShowPage(WizardSteps.Plugins)}
                    transitionDirection={getTransitionDirection(WizardSteps.Plugins)}
                    className='child-page'
                    handleVisitMarketPlaceClick={() => {
                        trackEvent('first_admin_setup', 'click_visit_marketplace_link');
                    }}
                />
                <InviteMembers
                    onPageView={onPageViews[WizardSteps.InviteMembers]}
                    next={() => {
                        skipTeamMembers(false);
                        const inviteMembersTracking = {
                            inviteCount: form.teamMembers.invites.length,
                        };
                        setSubmissionState(SubmissionStates.UserRequested);
                        makeNext(WizardSteps.InviteMembers)(inviteMembersTracking);
                    }}
                    skip={() => {
                        skipTeamMembers(true);
                        setSubmissionState(SubmissionStates.UserRequested);
                        makeNext(WizardSteps.InviteMembers, true)();
                    }}
                    previous={previous}
                    show={shouldShowPage(WizardSteps.InviteMembers)}
                    transitionDirection={getTransitionDirection(WizardSteps.InviteMembers)}
                    disableEdits={submissionState !== SubmissionStates.Presubmit && submissionState !== SubmissionStates.SubmitFail}
                    className='child-page'
                    teamInviteId={team?.invite_id || form.teamMembers.inviteId}
                    configSiteUrl={configSiteUrl}
                    formUrl={form.url}
                    browserSiteUrl={browserSiteUrl}
                    emails={form.teamMembers.invites}
                    setEmails={(emails: string[]) => {
                        setForm({
                            ...form,
                            teamMembers: {
                                ...form.teamMembers,
                                invites: emails,
                            },
                        });
                    }}
                    inferredProtocol={form.inferredProtocol}
                    isSelfHosted={isSelfHosted}
                />
                <LaunchingWorkspace
                    onPageView={onPageViews[WizardSteps.LaunchingWorkspace]}
                    show={currentStep === WizardSteps.LaunchingWorkspace}
                    transitionDirection={getTransitionDirection(WizardSteps.LaunchingWorkspace)}
                />
            </div>
            <div className={`PreparingWorkspace__invite-members-illustration ${getInviteMembersAnimationClass()}`}>
                <InviteMembersIllustration/>
            </div>
            <div className={`PreparingWorkspace__roles-illustration ${getRolesAnimationClass()}`}>
                <RolesIllustration/>
            </div>
        </div>
    );
};

export default PreparingWorkspace;
