// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import Scrollbars from 'react-custom-scrollbars';
import styled from 'styled-components';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {ArrowDownIcon, PlusIcon} from '@mattermost/compass-icons/components';
import {FormattedMessage} from 'react-intl';

import {PresetTemplates} from 'src/components/templates/template_data';
import {DraftPlaybookWithChecklist} from 'src/types/playbook';
import {SemiBoldHeading} from 'src/styles/headings';
import {
    RHSContainer,
    RHSContent,
    renderThumbVertical,
    renderTrackHorizontal,
    renderView,
} from 'src/components/rhs/rhs_shared';
import {displayPlaybookCreateModal} from 'src/actions';
import {telemetryEventForTemplate} from 'src/client';
import {useCanCreatePlaybooksInTeam, useViewTelemetry} from 'src/hooks';
import {RHSHomeTemplate} from 'src/components/rhs/rhs_home_item';
import PageRunCollaborationSvg from 'src/components/assets/page_run_collaboration_svg';
import {PrimaryButton} from 'src/components/assets/buttons';
import {RHSTitleRemoteRender} from 'src/rhs_title_remote_render';

import {GeneralViewTarget} from 'src/types/telemetry';

import {RHSTitleText} from './rhs_title_common';

const WelcomeBlock = styled.div`
    padding: 4rem 3rem 2rem;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const WelcomeDesc = styled.p`
    font-size: 14px;
    line-height: 21px;
    font-weight: 400;
    margin-bottom: 3rem;
`;

const WelcomeCreateAlt = styled.span`
    display: inline-flex;
    align-items: center;
    vertical-align: top;
    padding: 1rem 0;

    > svg {
        margin-left: 0.5em;
    }
`;

const WelcomeButtonCreate = styled(PrimaryButton)`
    margin-right: 2rem;
    margin-bottom: 1rem;
    padding: 0 2rem;

    > svg {
        margin-right: 0.5rem;
    }
`;

const WelcomeWarn = styled(WelcomeDesc)`
    color: rgba(var(--error-text-color-rgb), 0.72);
`;

const Header = styled.div`
    min-height: 13rem;
    margin-bottom: 4rem;
    display: grid;
`;

const Heading = styled.h4`
    font-size: 18px;
    line-height: 24px;
    font-weight: 700;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const ListHeading = styled(Heading)`
    ${SemiBoldHeading} {
    }

    padding-left: 2.75rem;
`;

const ListSection = styled.div`
    margin-top: 1rem;
    margin-bottom: 5rem;
    box-shadow: 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.08);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    grid-template-rows: repeat(auto-fill, minmax(100px, 1fr));
    position: relative;

    &::after {
        content: '';
        display: block;
        position: absolute;
        width: 100%;
        height: 1px;
        bottom: 0;
        box-shadow: 0px -1px 0px rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const RHSHome = () => {
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const canCreatePlaybooks = useCanCreatePlaybooksInTeam(currentTeamId || '');
    useViewTelemetry(GeneralViewTarget.ChannelsRHSHome, 'fixed');
    const newPlaybook = (template?: DraftPlaybookWithChecklist) => {
        if (template) {
            telemetryEventForTemplate(template.title, 'use_template_option');
        }

        dispatch(displayPlaybookCreateModal({startingTemplate: template?.title}));
    };

    const headerContent = (
        <WelcomeBlock>
            <PageRunCollaborationSvg/>
            <Heading>
                <FormattedMessage defaultMessage='Welcome to Playbooks!'/>
            </Heading>
            <WelcomeDesc>
                <FormattedMessage
                    defaultMessage='A playbook prescribes the checklists, automations, and templates for any repeatable procedures. {br} It helps teams reduce errors, earn trust with stakeholders, and become more effective with every iteration.'
                    values={{br: <br/>}}
                />
            </WelcomeDesc>
            {canCreatePlaybooks ? (
                <div>
                    <WelcomeButtonCreate
                        onClick={() => newPlaybook()}
                    >
                        <PlusIcon size={16}/>
                        <FormattedMessage defaultMessage='Create playbook'/>
                    </WelcomeButtonCreate>
                    <WelcomeCreateAlt>
                        <FormattedMessage defaultMessage='…or start with a template'/>
                        <ArrowDownIcon size={16}/>
                    </WelcomeCreateAlt>
                </div>
            ) : (
                <WelcomeWarn>
                    <FormattedMessage defaultMessage="You don't have permission to create playbooks in this workspace."/>
                </WelcomeWarn>
            )}
        </WelcomeBlock>
    );

    return (
        <>
            <RHSTitleRemoteRender>
                <RHSTitleText>
                    {/* product name; don't translate */}
                    {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                    {'Playbooks'}
                </RHSTitleText>
            </RHSTitleRemoteRender>
            <RHSContainer>
                <RHSContent>
                    <Scrollbars
                        autoHide={true}
                        autoHideTimeout={500}
                        autoHideDuration={500}
                        renderThumbVertical={renderThumbVertical}
                        renderView={renderView}
                        renderTrackHorizontal={renderTrackHorizontal}
                        style={{position: 'absolute'}}
                    >
                        {<Header>{headerContent}</Header>}
                        {canCreatePlaybooks && (
                            <>
                                <ListHeading><FormattedMessage defaultMessage='Playbook Templates'/></ListHeading>
                                <ListSection>
                                    {PresetTemplates.map(({title, template}) => (
                                        <RHSHomeTemplate
                                            key={title}
                                            title={title}
                                            template={template}
                                            onUse={newPlaybook}
                                        />
                                    ))}
                                </ListSection>
                            </>
                        )}
                    </Scrollbars>
                </RHSContent>
            </RHSContainer>
        </>
    );
};

export default RHSHome;
