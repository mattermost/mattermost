// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {InviteType} from './invite_as';
import ResultTable from './result_table';
import type {InviteResult} from './result_table';

export type InviteResults = {
    sent: InviteResult[];
    notSent: InviteResult[];
}

export type ResultState = {
    sent: InviteResult[];
    notSent: InviteResult[];
    error: boolean;
};

export const defaultResultState = deepFreeze({
    sent: [],
    error: false,
    notSent: [],
});

type Props = {
    inviteType: InviteType;
    currentTeamName: string;
    onDone: () => void;
    headerClass: string;
    footerClass: string;
    inviteMore: () => void;
} & ResultState;

export default function ResultView(props: Props) {
    let inviteType;
    if (props.inviteType === InviteType.MEMBER) {
        inviteType = (
            <FormattedMessage
                id='invite_modal.invited_members'
                defaultMessage='Members'
            />
        );
    } else {
        inviteType = (
            <FormattedMessage
                id='invite_modal.invited_guests'
                defaultMessage='Guests'
            />
        );
    }

    return (
        <>
            <Modal.Header className={props.headerClass}>
                <h1
                    id='invitation_modal_title'
                    className='modal-title'
                >
                    <FormattedMessage
                        id='invite_modal.invited'
                        defaultMessage='{inviteType} invited to {team_name}'
                        values={{
                            inviteType,
                            team_name: props.currentTeamName,
                        }}
                    />
                </h1>
            </Modal.Header>
            <Modal.Body>
                {props.notSent.length > 0 && (
                    <ResultTable
                        sent={false}
                        rows={props.notSent}
                    />
                )}
                {props.sent.length > 0 && (
                    <ResultTable
                        sent={true}
                        rows={props.sent}
                    />
                )}
            </Modal.Body>
            <Modal.Footer className={props.footerClass}>
                <button
                    onClick={props.inviteMore}
                    className='btn btn-tertiary ResultView__inviteMore'
                    data-testid='invite-more'
                >
                    <FormattedMessage
                        id='invitation_modal.invite.more'
                        defaultMessage='Invite More People'
                    />
                </button>
                <button
                    onClick={props.onDone}
                    className='btn btn-primary'
                    data-testid='confirm-done'
                    aria-label='Close'
                    title='Close'
                >
                    <FormattedMessage
                        id='invitation_modal.confirm.done'
                        defaultMessage='Done'
                    />
                </button>
            </Modal.Footer>
        </>
    );
}
