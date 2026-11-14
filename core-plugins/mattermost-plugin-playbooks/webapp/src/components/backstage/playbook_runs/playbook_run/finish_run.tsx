// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {FlagOutlineIcon} from '@mattermost/compass-icons/components';

import {PlaybookRun, PlaybookRunStatus} from 'src/types/playbook_run';
import {TertiaryButton} from 'src/components/assets/buttons';
import {finishRun} from 'src/client';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';
import {ChecklistItemState} from 'src/types/playbook';

interface ChecklistsSubset {
    items: {
        state: string
    }[]
}

const outstandingTasks = (checklists: ChecklistsSubset[]) => {
    let count = 0;
    for (const list of checklists) {
        for (const item of list.items) {
            if (item.state === ChecklistItemState.Open || item.state === ChecklistItemState.InProgress) {
                count++;
            }
        }
    }
    return count;
};

export const useFinishRunConfirmationMessage = (run: Maybe<{checklists: ChecklistsSubset[], name: string}>) => {
    const {formatMessage} = useIntl();
    const outstanding = outstandingTasks(run?.checklists || []);
    const values = {
        i: (x: React.ReactNode) => <i>{x}</i>,
        runName: run?.name || '',
    };
    let confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to finish <i>{runName}</i> for all participants?'}, values);
    if (outstanding > 0) {
        confirmationMessage = formatMessage(
            {defaultMessage: 'There {outstanding, plural, =1 {is # outstanding task} other {are # outstanding tasks}}. Are you sure you want to finish <i>{runName}</i> for all participants?'},
            {...values, outstanding}
        );
    }
    return confirmationMessage;
};

export const useOnFinishRun = (playbookRun: PlaybookRun, location: string = 'backstage') => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const refreshLHS = useLHSRefresh();
    const confirmationMessage = useFinishRunConfirmationMessage(playbookRun);

    return () => {
        const onConfirm = async () => {
            await finishRun(playbookRun.id);

            // Only refresh LHS when in Backstage, not in RHS
            if (location === 'backstage') {
                refreshLHS();
            }
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: formatMessage({defaultMessage: 'Confirm finish'}),
            message: confirmationMessage,
            confirmButtonText: formatMessage({defaultMessage: 'Finish'}),
            onConfirm,
            // eslint-disable-next-line no-empty-function
            onCancel: () => {},
        })));
    };
};

interface Props {
    playbookRun: PlaybookRun;
}

const FinishRun = ({playbookRun}: Props) => {
    const {formatMessage} = useIntl();

    const onFinishRun = useOnFinishRun(playbookRun);

    if (playbookRun.current_status === PlaybookRunStatus.Finished) {
        return null;
    }

    return (
        <Container data-testid={'run-finish-section'}>
            <Content>
                <IconWrapper>
                    <FlagOutlineIcon size={24}/>
                </IconWrapper>
                <Text>{formatMessage({defaultMessage: 'Time to wrap up?'})}</Text>
                <RightWrapper>
                    <FinishRunButton onClick={onFinishRun}>
                        {formatMessage({defaultMessage: 'Finish'})}
                    </FinishRunButton>
                </RightWrapper>
            </Content>
        </Container>
    );
};

export default FinishRun;

const Container = styled.div`
    display: flex;
    flex-direction: column;
    margin-top: 24px;
`;

const Content = styled.div`
    display: flex;
    height: 56px;
    flex-direction: row;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;

const IconWrapper = styled.div`
    display: flex;
    margin-left: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.32);
`;

const Text = styled.div`
    display: flex;
    margin: 0 4px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    line-height: 20px;
`;

const RightWrapper = styled.div`
    display: flex;
    flex: 1;
    justify-content: flex-end;
`;

const FinishRunButton = styled(TertiaryButton)`
    height: 32px;
    padding: 0 48px;
    font-size: 12px;
`;

