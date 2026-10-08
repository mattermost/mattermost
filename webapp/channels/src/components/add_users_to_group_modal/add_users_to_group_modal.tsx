// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useMemo, useRef} from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';

import {ArrowLeftIcon, CloseIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {useFocusTrap} from '@mattermost/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AddUserToGroupMultiSelect from 'components/add_user_to_group_multiselect';

import type {ModalData} from 'types/actions';

import 'components/user_groups_modal/user_groups_modal.scss';

export type Props = {
    onExited: () => void;
    groupId: string;
    group: Group;
    backButtonCallback: () => void;
    actions: {
        addUsersToGroup: (groupId: string, userIds: string[]) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

const AddUsersToGroupModal = (props: Props) => {
    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);
    const [usersToAdd, setUsersToAdd] = useState<UserProfile[]>([]);
    const [showUnknownError, setShowUnknownError] = useState(false);
    const {formatMessage} = useIntl();

    const modalRef = useRef<HTMLDivElement>(null);
    useFocusTrap(show, modalRef);

    const doHide = useCallback(() => {
        setShow(false);
    }, []);

    const isSaveEnabled = useCallback(() => {
        return usersToAdd.length > 0;
    }, [usersToAdd]);

    const addUserCallback = useCallback((users: UserProfile[]): void => {
        setUsersToAdd(users);
    }, []);

    const deleteUserCallback = useCallback((users: UserProfile[]): void => {
        setUsersToAdd(users);
    }, []);

    const goBack = useCallback(() => {
        props.backButtonCallback();
        props.onExited();
    }, [props.backButtonCallback, props.onExited]);

    const addUsersToGroup = useCallback(async (users?: UserProfile[]) => {
        setSaving(true);
        if (!users || users.length === 0) {
            setSaving(false);
            return;
        }
        const userIds = users.map((user) => {
            return user.id;
        });

        const data = await props.actions.addUsersToGroup(props.groupId, userIds);

        if (data?.error) {
            setShowUnknownError(true);
            setSaving(false);
        } else {
            goBack();
        }
    }, [goBack, props.actions.addUsersToGroup, props.groupId]);

    const searchOptions = useMemo(() => {
        return {
            not_in_group_id: props.groupId,
        };
    }, [props.groupId]);

    const titleValue = useMemo(() => {
        return {
            group: props.group.display_name,
        };
    }, [props.group.display_name]);

    return (
        <Modal
            dialogClassName='a11y__modal user-groups-modal-create'
            show={show}
            onHide={doHide}
            onExited={props.onExited}
            role='none'
            aria-labelledby='createUserGroupsModalLabel'
            id='addUsersToGroupsModal'
        >
            <div ref={modalRef}>
                <Modal.Header closeButton={false}>
                    <div className='user-groups-modal__header-title-row d-flex align-items-start'>
                        <WithTooltip title={formatMessage({id: 'user_groups_modal.goBackLabel', defaultMessage: 'Back'})}>
                            <IconButton
                                size='medium'
                                className='modal-header-back-button'
                                icon={<Icon glyph={<ArrowLeftIcon/>}/>}
                                aria-label={formatMessage({id: 'user_groups_modal.goBackLabel', defaultMessage: 'Back'})}
                                onClick={goBack}
                            />
                        </WithTooltip>
                        <Modal.Title
                            componentClass='h1'
                            id='addUsersToGroupsModalLabel'
                        >
                            <FormattedMessage
                                id='user_groups_modal.addPeopleTitle'
                                // eslint-disable-next-line formatjs/enforce-placeholders -- group provided via titleValue memoized value
                                defaultMessage='Add people to {group}'
                                values={titleValue}
                            />
                        </Modal.Title>
                    </div>
                    <WithTooltip title={formatMessage({id: 'generic.close', defaultMessage: 'Close'})}>
                        <IconButton
                            className='user-groups-modal__header-close'
                            size='medium'
                            icon={<Icon glyph={<CloseIcon/>}/>}
                            onClick={doHide}
                            aria-label={formatMessage({id: 'generic.close', defaultMessage: 'Close'})}
                        />
                    </WithTooltip>
                </Modal.Header>
                <Modal.Body
                    className='overflow--visible'
                >
                    <div className='user-groups-modal__content'>
                        <form role='form'>
                            <div className='group-add-user'>
                                <AddUserToGroupMultiSelect
                                    multilSelectKey={'addUsersToGroupKey'}
                                    onSubmitCallback={addUsersToGroup}
                                    focusOnLoad={false}
                                    savingEnabled={isSaveEnabled()}
                                    addUserCallback={addUserCallback}
                                    deleteUserCallback={deleteUserCallback}
                                    groupId={props.groupId}
                                    searchOptions={searchOptions}
                                    buttonSubmitText={defineMessage({id: 'multiselect.addPeopleToGroup', defaultMessage: 'Add People'})}
                                    buttonSubmitLoadingText={defineMessage({id: 'multiselect.adding', defaultMessage: 'Adding...'})}
                                    backButtonClick={goBack}
                                    saving={saving}
                                />
                            </div>
                            {
                                showUnknownError &&
                                <div className='Input___error group-error'>
                                    <i className='icon icon-alert-outline'/>
                                    <FormattedMessage
                                        id='user_groups_modal.unknownError'
                                        defaultMessage='An unknown error has occurred.'
                                    />
                                </div>
                            }
                        </form>
                    </div>
                </Modal.Body>
            </div>
        </Modal>
    );
};

export default React.memo(AddUsersToGroupModal);
