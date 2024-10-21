// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useMemo} from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {addUsersToGroup as addUsersToGroupAction} from 'mattermost-redux/actions/groups';

import AddUserToGroupMultiSelect from 'components/add_user_to_group_multiselect';

import 'components/user_groups_modal/user_groups_modal.scss';

export type Props = {
    onExited: () => void;
    groupId: string;
    group: Group;
    backButtonCallback: () => void;
}

const messages = defineMessages({
    add: {id: 'multiselect.addPeopleToGroup', defaultMessage: 'Add People'},
    adding: {id: 'multiselect.adding', defaultMessage: 'Adding...'},
});

const AddUsersToGroupModal = ({
    backButtonCallback,
    group,
    groupId,
    onExited,
}: Props) => {
    const dispatch = useDispatch();

    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);
    const [usersToAdd, setUsersToAdd] = useState<UserProfile[]>([]);
    const [showUnknownError, setShowUnknownError] = useState(false);
    const {formatMessage} = useIntl();

    const isSaveEnabled = usersToAdd.length > 0;

    const doHide = useCallback(() => {
        setShow(false);
    }, []);

    const goBack = useCallback(() => {
        backButtonCallback();
        onExited();
    }, [backButtonCallback, onExited]);

    const addUsersToGroup = useCallback(async (users?: UserProfile[]) => {
        setSaving(true);
        if (!users || users.length === 0) {
            setSaving(false);
            return;
        }
        const userIds = users.map((user) => {
            return user.id;
        });

        const data = await dispatch(addUsersToGroupAction(groupId, userIds));

        if (data?.error) {
            setShowUnknownError(true);
            setSaving(false);
        } else {
            goBack();
        }
    }, [dispatch, goBack, groupId]);

    const searchOptions = useMemo(() => {
        return {
            not_in_group_id: groupId,
        };
    }, [groupId]);

    const titleValue = useMemo(() => {
        return {
            group: group.display_name,
        };
    }, [group.display_name]);

    return (
        <Modal
            dialogClassName='a11y__modal user-groups-modal-create'
            show={show}
            onHide={doHide}
            onExited={onExited}
            role='dialog'
            aria-labelledby='createUserGroupsModalLabel'
            id='addUsersToGroupsModal'
        >
            <Modal.Header closeButton={true}>
                <div className='d-flex align-items-center'>
                    <button
                        type='button'
                        className='modal-header-back-button btn btn-icon'
                        aria-label={formatMessage({id: 'user_groups_modal.goBackLabel', defaultMessage: 'Back'})}
                        onClick={goBack}
                    >
                        <i className='icon icon-arrow-left'/>
                    </button>
                    <Modal.Title
                        componentClass='h1'
                        id='addUsersToGroupsModalLabel'
                    >
                        <FormattedMessage
                            id='user_groups_modal.addPeopleTitle'
                            defaultMessage='Add people to {group}'
                            values={titleValue}
                        />
                    </Modal.Title>
                </div>
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
                                savingEnabled={isSaveEnabled}
                                addUserCallback={setUsersToAdd}
                                deleteUserCallback={setUsersToAdd}
                                groupId={groupId}
                                searchOptions={searchOptions}
                                buttonSubmitText={messages.add}
                                buttonSubmitLoadingText={messages.adding}
                                backButtonClick={goBack}
                                backButtonClass={'multiselect-back'}
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
        </Modal>
    );
};

export default React.memo(AddUsersToGroupModal);
