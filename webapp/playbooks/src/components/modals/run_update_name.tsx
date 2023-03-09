// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useEffect, useState} from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';

import GenericModal, {InlineLabel, ModalSubheading} from 'src/components/widgets/generic_modal';
import {BaseInput} from 'src/components/assets/inputs';
import {useRun} from 'src/hooks';
import {PlaybookRunType} from 'src/graphql/generated/graphql';

const ID = 'playbook_run_update';

type Props = {
    playbookRunId: string;
    teamId: string;
    onSubmit: (newName: string) => void;
} & Partial<ComponentProps<typeof GenericModal>>;

export const makeModalDefinition = (props: Props) => ({
    modalId: ID,
    dialogType: UpdateRunModal,
    dialogProps: props,
});

const UpdateRunModal = ({
    playbookRunId,
    teamId,
    onSubmit,
    ...modalProps
}: Props) => {
    const {formatMessage} = useIntl();
    const [name, setName] = useState('');
    const [run] = useRun(playbookRunId);
    const isPlaybookRun = run?.type === PlaybookRunType.Playbook;

    useEffect(() => {
        if (run) {
            setName(run.name);
        }
    }, [run, run?.name]);

    return (
        <StyledGenericModal
            cancelButtonText={formatMessage({defaultMessage: 'Cancel'})}
            confirmButtonText={formatMessage({defaultMessage: 'Save'})}
            showCancel={true}
            isConfirmDisabled={name === '' || name === run?.name}
            handleConfirm={() => onSubmit(name)}
            id={ID}
            modalHeaderText={
                <Header>
                    {isPlaybookRun ? formatMessage({defaultMessage: 'Rename run'}) : formatMessage({defaultMessage: 'Rename checklist'})}
                    <ModalSubheading>
                        {run?.name}
                    </ModalSubheading>
                </Header>
            }
            {...modalProps}
        >
            <Body>
                <InlineLabel>{isPlaybookRun ? formatMessage({defaultMessage: 'Run name'}) : formatMessage({defaultMessage: 'Checklist name'})}</InlineLabel>
                <BaseInput
                    data-testid={'run-name-input'}
                    autoFocus={true}
                    type={'text'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </Body>
        </StyledGenericModal>
    );
};

const StyledGenericModal = styled(GenericModal)`
    &&& {
        h1 {
            width:100%;
        }
        .modal-header {
            padding: 24px 31px 5px 31px;
            margin-bottom: 0;
        }
        .modal-content {
            padding: 0px;
        }
        .modal-body {
            padding: 10px 31px;
        }
        .modal-footer {
           padding: 0 31px 28px 31px;
        }
    }
`;

const Header = styled.div`
    display: flex;
    flex-direction: column;
`;

const Body = styled.div`
    display: flex;
    flex-direction: column;
    & > div, & > input {
        margin-bottom: 12px;
    }
`;

