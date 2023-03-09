// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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
    let confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to finish the run <i>{runName}</i> for all participants?'}, values);
    if (outstanding > 0) {
        confirmationMessage = formatMessage(
            {defaultMessage: 'There {outstanding, plural, =1 {is # outstanding task} other {are # outstanding tasks}}. Are you sure you want to finish the run <i>{runName}</i> for all participants?'},
            {...values, outstanding}
        );
    }
    return confirmationMessage;
};

export const useOnFinishRun = (playbookRun: PlaybookRun) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const refreshLHS = useLHSRefresh();
    const confirmationMessage = useFinishRunConfirmationMessage(playbookRun);

    return () => {
        const onConfirm = async () => {
            await finishRun(playbookRun.id);
            refreshLHS();
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: formatMessage({defaultMessage: 'Confirm finish run'}),
            message: confirmationMessage,
            confirmButtonText: formatMessage({defaultMessage: 'Finish run'}),
            onConfirm,
            // eslint-disable-next-line @typescript-eslint/no-empty-function
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
                        {formatMessage({defaultMessage: 'Finish run'})}
                    </FinishRunButton>
                </RightWrapper>
            </Content>
        </Container>
    );
};

export default FinishRun;

const Container = styled.div`
    margin-top: 24px;
    display: flex;
    flex-direction: column;
`;

const Content = styled.div`
    display: flex;
    flex-direction: row;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 12px;
    border-radius: 4px;
    height: 56px;
    align-items: center;
`;

const IconWrapper = styled.div`
    margin-left: 4px;
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.32);
`;

const Text = styled.div`
    margin: 0 4px;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    display: flex;
`;

const RightWrapper = styled.div`
    display: flex;
    justify-content: flex-end;
    flex: 1;
`;

const FinishRunButton = styled(TertiaryButton)`
    font-size: 12px;
    height: 32px;
    padding: 0 48px;
`;

