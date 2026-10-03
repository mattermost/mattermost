// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
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
import {useCanCreatePlaybooksInTeam} from 'src/hooks';
import {RHSHomeTemplate} from 'src/components/rhs/rhs_home_item';
import PlaybookListSvg from 'src/components/assets/illustrations/playbook_list_svg';
import {PrimaryButton} from 'src/components/assets/buttons';
import {RHSTitleRemoteRender} from 'src/rhs_title_remote_render';

import {RHSTitleText} from './rhs_title_common';

const WelcomeBlock = styled.div`
    padding: 4rem 3rem 2rem;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const WelcomeDesc = styled.p`
    margin-bottom: 3rem;
    font-size: 14px;
    font-weight: 400;
    line-height: 21px;
`;

const WelcomeCreateAlt = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 1rem 0;
    vertical-align: top;

    > svg {
        margin-left: 0.5em;
    }
`;

const WelcomeButtonCreate = styled(PrimaryButton)`
    padding: 0 2rem;
    margin-right: 2rem;
    margin-bottom: 1rem;

    > svg {
        margin-right: 0.5rem;
    }
`;

const WelcomeWarn = styled(WelcomeDesc)`
    color: rgba(var(--error-text-color-rgb), 0.72);
`;

const Header = styled.div`
    display: grid;
    min-height: 13rem;
    margin-bottom: 4rem;
`;

const Heading = styled.h3`
    ${SemiBoldHeading}
    font-size: 30px;
    color: var(--center-channel-color);
    letter-spacing: -0.01em;
`;

const ListHeading = styled.h4`
    ${SemiBoldHeading}
    font-size: 18px;
    padding-left: 2.75rem;
    letter-spacing: -0.005em;
`;

const ListSection = styled.div`
    position: relative;
    display: grid;
    margin-top: 1rem;
    margin-bottom: 5rem;
    box-shadow: 0 -1px 0 rgba(var(--center-channel-color-rgb), 0.08);
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    grid-template-rows: repeat(auto-fill, minmax(100px, 1fr));

    &::after {
        position: absolute;
        bottom: 0;
        display: block;
        width: 100%;
        height: 1px;
        box-shadow: 0 -1px 0 rgba(var(--center-channel-color-rgb), 0.08);
        content: '';
    }
`;

const RHSHome = () => {
    const dispatch = useDispatch();
    const currentTeamId = useSelector(getCurrentTeamId);
    const canCreatePlaybooks = useCanCreatePlaybooksInTeam(currentTeamId || '');
    const newPlaybook = (template?: DraftPlaybookWithChecklist) => {
        dispatch(displayPlaybookCreateModal({startingTemplate: template?.title}));
    };

    const headerContent = (
        <WelcomeBlock>
            <PlaybookListSvg size={119}/>
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
                        <FormattedMessage defaultMessage='…or start with an example'/>
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
                                <ListHeading><FormattedMessage defaultMessage='Playbook Examples'/></ListHeading>
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
