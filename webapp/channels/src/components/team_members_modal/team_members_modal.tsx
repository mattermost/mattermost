// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import {Button} from '@mattermost/shared/components/button';
import type {Team} from '@mattermost/types/teams';

import Permissions from 'mattermost-redux/constants/permissions';

import AlertBanner from 'components/alert_banner';
import useAccessControlAttributes, {EntityType} from 'components/common/hooks/useAccessControlAttributes';
import InvitationModal from 'components/invitation_modal';
import MemberListTeam from 'components/member_list_team';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import AlertTag from 'components/widgets/tag/alert_tag';
import TagGroup from 'components/widgets/tag/tag_group';

import {focusElement} from 'utils/a11y_utils';
import {ModalIdentifiers} from 'utils/constants';
import {formatAttributeName} from 'utils/format_attribute_name';

import type {ModalData} from 'types/actions';

import './team_members_modal.scss';

// MembershipRequirementsBanner shows the team's membership requirements (a notice
// plus the governing attribute tags) when the team is policy-enforced. Attribute
// values that the viewer is not permitted to see are stripped server-side, so a
// non-holder sees only the generic notice. Rendered as a status region for a11y.
function MembershipRequirementsBanner({team}: {team: Team}) {
    const isGoverned = Boolean(team.policy_enforced);
    const {structuredAttributes} = useAccessControlAttributes(EntityType.Team, team.id, isGoverned);

    if (!isGoverned) {
        return null;
    }

    const tags = structuredAttributes.length === 0 ? null : (
        <TagGroup>
            {structuredAttributes.flatMap((attribute) =>
                attribute.values.map((value) => {
                    const attributeLabel = formatAttributeName(attribute.name);
                    return (
                        <AlertTag
                            key={`${attribute.name}-${value}`}
                            tooltipTitle={attributeLabel}
                            text={`${attributeLabel}: ${value}`}
                        />
                    );
                }),
            )}
        </TagGroup>
    );

    return (
        <div
            className='teamMembersModal__policyBanner'
            role='status'
        >
            <AlertBanner
                mode='info'
                variant='app'
                title={
                    <FormattedMessage
                        id='team_member_modal.policy_enforced.title'
                        defaultMessage='Team access is restricted by user attributes'
                    />
                }
                message={
                    <FormattedMessage
                        id='team_member_modal.policy_enforced.description'
                        defaultMessage='Only people who meet the membership requirements can be members of this team.'
                    />
                }
            >
                {tags}
            </AlertBanner>
        </div>
    );
}

type Props = {
    currentTeam?: Team;
    onExited: () => void;
    onLoad?: () => void;
    focusOriginElement?: string;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

type State = {
    show: boolean;
};

export default class TeamMembersModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    componentDidMount() {
        if (this.props.onLoad) {
            this.props.onLoad();
        }
    }

    handleHide = () => {
        this.setState({show: false});
    };

    handleInvitePeople = () => {
        const {actions} = this.props;

        actions.openModal({
            modalId: ModalIdentifiers.INVITATION,
            dialogType: InvitationModal,
        });

        this.handleHide();
    };

    handleExit = () => {
        if (this.props.focusOriginElement) {
            focusElement(this.props.focusOriginElement, true);
        }
        this.props.onExited();
    };

    render() {
        let teamDisplayName = '';
        if (this.props.currentTeam) {
            teamDisplayName = this.props.currentTeam.display_name;
        }

        return (
            <GenericModal
                id='teamMembersModal'
                className='more-modal'
                compassDesign={true}
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
                modalHeaderTextId='teamMemberModalLabel'
                modalHeaderText={
                    <FormattedMessage
                        id='team_member_modal.members'
                        defaultMessage='{team} Members'
                        values={{
                            team: teamDisplayName,
                        }}
                    />
                }
                ariaLabelledby='teamMemberModalLabel'
                headerButton={
                    <TeamPermissionGate
                        teamId={this.props.currentTeam?.id}
                        permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
                    >
                        <Button
                            id='invitePeople'
                            type='button'
                            emphasis='primary'
                            size='sm'
                            onClick={this.handleInvitePeople}
                        >
                            <FormattedMessage
                                id='team_member_modal.invitePeople'
                                defaultMessage='Invite People'
                            />
                        </Button>
                    </TeamPermissionGate>
                }
                enforceFocus={false}
                modalLocation='top'
                bodyPadding={false}
            >
                {this.props.currentTeam && <MembershipRequirementsBanner team={this.props.currentTeam}/>}
                <MemberListTeam
                    teamId={this.props.currentTeam?.id}
                />
            </GenericModal>
        );
    }
}
