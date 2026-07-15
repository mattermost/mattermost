// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {InviteType} from './invite_as';
import ResultTable from './result_table';
import type {InviteResult} from './result_table';

export type InviteResults = {
    sent: InviteResult[];
    notSent: InviteResult[];
};

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

type Props = ResultState;

type ResultViewTitleProps = {
    inviteType: InviteType;
    currentTeamName: string;
};

type ResultViewFooterProps = {
    onDone: () => void;
    inviteMore: () => void;
};

export function ResultViewTitle(props: ResultViewTitleProps) {
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
        <FormattedMessage
            id='invite_modal.invited'
            defaultMessage='{inviteType} invited to {team_name}'
            values={{
                inviteType,
                team_name: props.currentTeamName,
            }}
        />
    );
}

export function ResultViewFooter(props: ResultViewFooterProps) {
    return (
        <>
            <Button
                onClick={props.inviteMore}
                emphasis='tertiary'
                data-testid='invite-more'
            >
                <FormattedMessage
                    id='invitation_modal.invite.more'
                    defaultMessage='Invite More People'
                />
            </Button>
            <Button
                onClick={props.onDone}
                emphasis='primary'
                data-testid='confirm-done'
                aria-label='Close'
                title='Close'
            >
                <FormattedMessage
                    id='invitation_modal.confirm.done'
                    defaultMessage='Done'
                />
            </Button>
        </>
    );
}

export default function ResultView(props: Props) {
    return (
        <>
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
        </>
    );
}
