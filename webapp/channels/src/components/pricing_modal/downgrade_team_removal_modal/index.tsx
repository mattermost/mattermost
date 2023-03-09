// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {isEmpty} from 'lodash';
import {Modal} from 'react-bootstrap';

import {useDispatch, useSelector} from 'react-redux';

import {Team} from '@mattermost/types/teams';
import {Feedback, Product} from '@mattermost/types/cloud';
import {t} from 'utils/i18n';
import RadioButtonGroup from 'components/common/radio_group';
import DropdownInput, {ValueType} from 'components/dropdown_input';
import CloudSubscribeWithLoadingModal from 'components/cloud_subscribe_with_loading_modal';
import useGetUsage from 'components/common/hooks/useGetUsage';
import DowngradeFeedback from 'components/feedback_modal/downgrade_feedback';
import {getTeams} from 'mattermost-redux/actions/teams';
import {getActiveTeamsList} from 'mattermost-redux/selectors/entities/teams';
import {closeModal, openModal} from 'actions/views/modals';
import {ModalIdentifiers} from 'utils/constants';
import {isModalOpen} from 'selectors/views/modals';
import {GlobalState} from 'types/store';

import {fallbackStarterLimits, asGBString} from 'utils/limits';

import './downgrade_team_removal_modal.scss';

type Props = {
    product_id: string;
    starterProduct: Product | null | undefined;
};

function DowngradeTeamRemovalModal(props: Props) {
    const dispatch = useDispatch();
    const [radioValue, setRadioValue] = useState('');
    const [dropdownValue, setDropdownValue] = useState<ValueType | undefined>();

    const intl = useIntl();
    const isCloudDowngradeChooseTeamModalOpen = useSelector(
        (state: GlobalState) =>
            isModalOpen(state, ModalIdentifiers.CLOUD_DOWNGRADE_CHOOSE_TEAM),
    );

    const teams = useSelector(getActiveTeamsList);
    useEffect(() => {
        if (!teams) {
            dispatch(getTeams(0, 10000));
        }
    }, [teams]);
    const usage = useGetUsage();

    const onHide = () => {
        dispatch(closeModal(ModalIdentifiers.CLOUD_DOWNGRADE_CHOOSE_TEAM));
    };

    const onConfirmDowngrade = async () => {
        dispatch(closeModal(ModalIdentifiers.CLOUD_DOWNGRADE_CHOOSE_TEAM));
        dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));
        dispatch(openModal({
            modalId: ModalIdentifiers.FEEDBACK,
            dialogType: DowngradeFeedback,
            dialogProps: {
                onSubmit: downgrade,
            },
        }));
    };

    const downgrade = (downgradeFeedback: Feedback) => {
        const teamToKeep = getSelectedTeam();
        dispatch(openModal({
            modalId: ModalIdentifiers.CLOUD_SUBSCRIBE_WITH_LOADING_MODAL,
            dialogType: CloudSubscribeWithLoadingModal,
            dialogProps: {
                onBack: () => {
                    dispatch(
                        closeModal(
                            ModalIdentifiers.CLOUD_SUBSCRIBE_WITH_LOADING_MODAL,
                        ),
                    );
                    dispatch(
                        openModal({
                            modalId:
                                ModalIdentifiers.CLOUD_DOWNGRADE_CHOOSE_TEAM,
                            dialogType: DowngradeTeamRemovalModal,
                            dialogProps: {
                                product_id: props.starterProduct?.id || '',
                                starterProduct: props.starterProduct,
                            },
                        }),
                    );
                },
                teamToKeep,
                selectedProduct: props.starterProduct,
                downgradeFeedback,
            },
        }));
    };

    const getSelectedTeam = () => {
        let teamIdToKeep = '';
        if (radioValue && !dropdownValue) {
            teamIdToKeep = radioValue;
        } else {
            teamIdToKeep = dropdownValue?.value || '';
        }
        return teams.find((team: Team) => team.id === teamIdToKeep);
    };

    const selectionSection = (teamsList: Team[]) => {
        if (usage.teams.active < 4) {
            return (
                <RadioButtonGroup
                    id='deleteTeamRadioGroup'
                    testId='deleteTeamRadioGroup'
                    values={teamsList.map((team) => {
                        return {
                            value: team.id,
                            key: team.display_name,
                            testId: team.id,
                        };
                    })}
                    value={radioValue}
                    onChange={(e) => setRadioValue(e.target.value)}
                />
            );
        }

        return (
            <DropdownInput
                testId='deleteTeamDropdownInput'
                onChange={setDropdownValue}
                legend={intl.formatMessage({
                    id: t('admin.channel_settings.channel_list.teamHeader'),
                    defaultMessage: 'Team',
                })}
                placeholder={intl.formatMessage({
                    id: t('downgrade_plan_modal.selectTeam'),
                    defaultMessage: 'Select team',
                })}
                value={dropdownValue}
                options={teamsList.map((team) => {
                    return {
                        label: team.display_name,
                        value: team.id,
                    };
                })}
            />
        );
    };

    return (
        <Modal
            className='DowngradeTeamRemovalModal'
            show={isCloudDowngradeChooseTeamModalOpen}
            backdropClassName={'downgrade-modal-backdrop'}
            id='downgradeTeamRemovalModal'
            onExited={onHide}
            data-testid='downgradeTeamRemovalModal'
            dialogClassName='a11y__modal'
            onHide={onHide}
            role='dialog'
            aria-modal='true'
            aria-labelledby='downgradeTeamRemovalModalTitle'
        >
            <>
                <Modal.Header className='DowngradeTeamRemovalModal__header'>
                    <FormattedMessage
                        id='downgrade_plan_modal.title'
                        defaultMessage='Confirm Plan Downgrade'
                    />
                    <button
                        id='closeIcon'
                        className='icon icon-close'
                        aria-label='Close'
                        title='Close'
                        onClick={onHide}
                    />
                </Modal.Header>
                <Modal.Body>
                    <div className='DowngradeTeamRemovalModal__body'>
                        <div>
                            <FormattedMessage
                                id='downgrade_plan_modal.subtitle'
                                defaultMessage='{planName} is restricted to {teams} team, {messages} messages, and {storage} file storage. <strong>If you downgrade, some data will be archived</strong>. Archived data can be accessible when you upgrade back'
                                values={{
                                    strong: (msg: React.ReactNode) => (
                                        <strong>{msg}</strong>
                                    ),
                                    planName: props.starterProduct?.name,
                                    messages: intl.formatNumber(
                                        fallbackStarterLimits.messages.
                                            history,
                                    ),
                                    storage: asGBString(
                                        fallbackStarterLimits.files.
                                            totalStorage,
                                        intl.formatNumber,
                                    ),
                                    teams: fallbackStarterLimits.teams.
                                        active,
                                }}
                            />
                        </div>
                        <div className='cta'>
                            <FormattedMessage
                                id='downgrade_plan_modal.whichTeamToUse'
                                defaultMessage='Which team would you like to continue using?'
                            />
                        </div>
                        <div className='DowngradeTeamRemovalModal__selectionSection'>
                            {selectionSection(teams)}
                        </div>
                        <div className='warning'>
                            <i className='icon icon-alert-outline'/>
                            <span className='warning-text'>
                                <FormattedMessage
                                    id='downgrade_plan_modal.alert'
                                    defaultMessage='The unselected teams will be automatically archived in the system console, but not deleted'
                                />
                            </span>
                        </div>
                    </div>
                    <div className='DowngradeTeamRemovalModal__buttons'>
                        <button
                            onClick={() =>
                                dispatch(
                                    closeModal(
                                        ModalIdentifiers.CLOUD_DOWNGRADE_CHOOSE_TEAM,
                                    ),
                                )
                            }
                            className='btn btn-light'
                        >
                            <FormattedMessage
                                id='admin.team_channel_settings.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
                        <button
                            disabled={
                                isEmpty(radioValue) &&
                                    isEmpty(dropdownValue)
                            }
                            onClick={onConfirmDowngrade}
                            className='btn btn-primary'
                        >
                            <FormattedMessage
                                id='downgrade_plan_modal.confirmDowngrade'
                                defaultMessage='Confirm Downgrade'
                            />
                        </button>
                    </div>
                </Modal.Body>
            </>

        </Modal>
    );
}

export default DowngradeTeamRemovalModal;
