// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';

import {
    AccountMultipleOutlineIcon,
    ApplicationCogIcon,
    DownloadOutlineIcon,
    InformationOutlineIcon,
    ViewGridPlusOutlineIcon,
    WebhookIncomingIcon,
} from '@mattermost/compass-icons/components';

import {Permissions} from 'mattermost-redux/constants';

import AboutBuildModal from 'components/about_build_modal';
import {
    OnboardingTaskCategory,
    OnboardingTasksName,
    TaskNameMapToSteps,
    useHandleOnBoardingTaskData,
    VisitSystemConsoleTour} from 'components/onboarding_tasks';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';
import UserGroupsModal from 'components/user_groups_modal';
import Menu from 'components/widgets/menu/menu';
import RestrictedIndicator from 'components/widgets/menu/menu_items/restricted_indicator';

import {FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS} from 'utils/cloud_utils';
import {LicenseSkus, ModalIdentifiers, MattermostFeatures} from 'utils/constants';
import {makeUrlSafe} from 'utils/url';
import * as UserAgent from 'utils/user_agent';

import type {PropsFromRedux} from './index';

const visitSystemConsoleTaskName = OnboardingTasksName.VISIT_SYSTEM_CONSOLE;

export interface Props extends PropsFromRedux {
    isMessaging: boolean;
}

export default function ProductMenuList(props: Props) {
    const {formatMessage} = useIntl();

    useEffect(() => {
        props.getPrevTrialLicense();
    }, []);

    const handleOnBoardingTaskData = useHandleOnBoardingTaskData();

    function handleVisitConsoleClick() {
        const steps = TaskNameMapToSteps[visitSystemConsoleTaskName];
        handleOnBoardingTaskData(visitSystemConsoleTaskName, steps.FINISHED, true, 'finish');
        localStorage.setItem(OnboardingTaskCategory, 'true');
    }

    function openGroupsModal() {
        props.openModal({
            modalId: ModalIdentifiers.USER_GROUPS,
            dialogType: UserGroupsModal,
            dialogProps: {
                backButtonAction: openGroupsModal,
            },
        });
    }

    return (
        <Menu.Group>
            <div>
                <Menu.CloudTrial id='menuCloudTrial'/>
                <SystemPermissionGate permissions={Permissions.SYSCONSOLE_READ_PERMISSIONS}>
                    <Menu.ItemLink
                        id='systemConsole'
                        to='/admin_console'
                        text={(
                            <>
                                {formatMessage({id: 'navbar_dropdown.console', defaultMessage: 'System Console'})}
                                {props.showVisitSystemConsoleTour && (
                                    <div
                                        onClick={handleVisitConsoleClick}
                                        className={'system-console-visit'}
                                    >
                                        <VisitSystemConsoleTour/>
                                    </div>
                                )}
                            </>
                        )}
                        icon={<ApplicationCogIcon size={18}/>}
                    />
                </SystemPermissionGate>
                <Menu.ItemLink
                    id='integrations'
                    show={props.isMessaging && props.areIntegrationsEnabled}
                    to={'/' + props.teamName + '/integrations'}
                    text={formatMessage({id: 'navbar_dropdown.integrations', defaultMessage: 'Integrations'})}
                    icon={<WebhookIncomingIcon size={18}/>}
                />
                <Menu.ItemToggleModalRedux
                    id='userGroups'
                    modalId={ModalIdentifiers.USER_GROUPS}
                    show={props.haveEnabledCustomUserGroups || props.isFreeTrial}
                    dialogType={UserGroupsModal}
                    dialogProps={{
                        backButtonAction: openGroupsModal,
                    }}
                    text={formatMessage({id: 'navbar_dropdown.userGroups', defaultMessage: 'User Groups'})}
                    icon={<AccountMultipleOutlineIcon size={18}/>}
                    sibling={(props.isCurrentUserAdmin && props.isFreeTrial) && (
                        <RestrictedIndicator
                            feature={MattermostFeatures.CUSTOM_USER_GROUPS}
                            minimumPlanRequiredForFeature={LicenseSkus.Professional}
                            tooltipMessage={formatMessage({
                                id: 'navbar_dropdown.userGroups.tooltip.cloudFreeTrial',
                                defaultMessage: 'During your trial you are able to create user groups. These user groups will be archived after your trial.',
                            })}
                            titleAdminPreTrial={formatMessage({
                                id: 'navbar_dropdown.userGroups.modal.titleAdminPreTrial',
                                defaultMessage: 'Try unlimited user groups with a free trial',
                            })}
                            messageAdminPreTrial={formatMessage({
                                id: 'navbar_dropdown.userGroups.modal.messageAdminPreTrial',
                                defaultMessage: 'Create unlimited user groups with one of our paid plans. Get the full experience of Enterprise when you start a free, {trialLength} day trial.',
                            },
                            {
                                trialLength: FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS,
                            },
                            )}
                            titleAdminPostTrial={formatMessage({
                                id: 'navbar_dropdown.userGroups.modal.titleAdminPostTrial',
                                defaultMessage: 'Upgrade to create unlimited user groups',
                            })}
                            messageAdminPostTrial={formatMessage({
                                id: 'navbar_dropdown.userGroups.modal.messageAdminPostTrial',
                                defaultMessage: 'User groups are a way to organize users and apply actions to all users within that group. Upgrade to the Professional plan to create unlimited user groups.',
                            })}
                            titleEndUser={formatMessage({
                                id: 'navbar_dropdown.userGroups.modal.titleEndUser',
                                defaultMessage: 'User groups available in paid plans',
                            })}
                            messageEndUser={formatMessage({
                                id: 'navbar_dropdown.userGroups.modal.messageEndUser',
                                defaultMessage: 'User groups are a way to organize users and apply actions to all users within that group.',
                            })}
                        />
                    )}
                />
                <TeamPermissionGate
                    teamId={props.teamId}
                    permissions={[Permissions.SYSCONSOLE_WRITE_PLUGINS]}
                >
                    <Menu.ItemToggleModalRedux
                        id='marketplaceModal'
                        modalId={ModalIdentifiers.PLUGIN_MARKETPLACE}
                        show={props.isMessaging && props.haveEnabledPluginMarketplace}
                        dialogType={MarketplaceModal}
                        dialogProps={{openedFrom: 'product_menu'}}
                        text={formatMessage({id: 'navbar_dropdown.marketplace', defaultMessage: 'App Marketplace'})}
                        icon={<ViewGridPlusOutlineIcon size={18}/>}
                    />
                </TeamPermissionGate>
                <Menu.ItemExternalLink
                    id='nativeAppLink'
                    show={props.appDownloadLink && !UserAgent.isMobileApp()}
                    url={makeUrlSafe(props.appDownloadLink)}
                    text={formatMessage({id: 'navbar_dropdown.nativeApps', defaultMessage: 'Download Apps'})}
                    icon={<DownloadOutlineIcon size={18}/>}
                />
                <Menu.ItemToggleModalRedux
                    id='about'
                    modalId={ModalIdentifiers.ABOUT}
                    dialogType={AboutBuildModal}
                    text={formatMessage({id: 'navbar_dropdown.about', defaultMessage: 'About {appTitle}'}, {appTitle: props.siteName})}
                    icon={<InformationOutlineIcon size={18}/>}
                />
            </div>
        </Menu.Group>
    );
}
