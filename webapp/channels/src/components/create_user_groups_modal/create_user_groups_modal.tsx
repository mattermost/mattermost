// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Modal} from 'react-bootstrap';

import {FormattedMessage} from 'react-intl';

import {UserProfile} from '@mattermost/types/users';

import * as Utils from 'utils/utils';
import {GroupCreateWithUserIds} from '@mattermost/types/groups';

import 'components/user_groups_modal/user_groups_modal.scss';
import './create_user_groups_modal.scss';
import {ModalData} from 'types/actions';
import Input from 'components/widgets/inputs/input/input';
import AddUserToGroupMultiSelect from 'components/add_user_to_group_multiselect';
import {ActionResult} from 'mattermost-redux/types/actions';
import LocalizedIcon from 'components/localized_icon';
import {t} from 'utils/i18n';
import {localizeMessage} from 'utils/utils';
import Constants, {ItemStatus} from 'utils/constants';

export type Props = {
    onExited: () => void;
    backButtonCallback?: () => void;
    actions: {
        createGroupWithUserIds: (group: GroupCreateWithUserIds) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

type State = {
    show: boolean;
    name: string;
    mention: string;
    savingEnabled: boolean;
    usersToAdd: UserProfile[];
    mentionUpdatedManually: boolean;
    mentionInputErrorText: string;
    nameInputErrorText: string;
    showUnknownError: boolean;
    saving: boolean;
}

export default class CreateUserGroupsModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
            name: '',
            mention: '',
            savingEnabled: false,
            usersToAdd: [],
            mentionUpdatedManually: false,
            mentionInputErrorText: '',
            nameInputErrorText: '',
            showUnknownError: false,
            saving: false,
        };
    }

    doHide = () => {
        this.setState({show: false});
    }
    isSaveEnabled = () => {
        return this.state.name.length > 0 && this.state.mention.length > 0 && this.state.usersToAdd.length > 0;
    }
    updateNameState = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        let mention = this.state.mention;
        if (!this.state.mentionUpdatedManually) {
            mention = value.replace(/[^A-Za-z0-9.\-_@]/g, '').toLowerCase();
            if (mention.substring(0, 1) !== '@') {
                mention = `@${mention}`;
            }
        }
        this.setState({name: value, mention});
    }

    updateMentionState = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        this.setState({mention: value, mentionUpdatedManually: true});
    }

    private addUserCallback = (usersToAdd: UserProfile[]): void => {
        this.setState({usersToAdd});
    };

    private deleteUserCallback = (usersToAdd: UserProfile[]): void => {
        this.setState({usersToAdd});
    };

    goBack = () => {
        if (typeof this.props.backButtonCallback === 'function') {
            this.props.backButtonCallback();
            this.props.onExited();
        }
    }

    createGroup = async (users?: UserProfile[]) => {
        this.setState({showUnknownError: false, mentionInputErrorText: '', nameInputErrorText: '', saving: true});
        let mention = this.state.mention;
        const displayName = this.state.name;

        if (!displayName || !displayName.trim()) {
            this.setState({nameInputErrorText: Utils.localizeMessage('user_groups_modal.nameIsEmpty', 'Name is a required field.'), saving: false});
            return;
        }

        if (!users || users.length === 0) {
            this.setState({saving: false});
            return;
        }
        if (mention.substring(0, 1) === '@') {
            mention = mention.substring(1, mention.length);
        }

        if (mention.length < 1) {
            this.setState({mentionInputErrorText: Utils.localizeMessage('user_groups_modal.mentionIsEmpty', 'Mention is a required field.'), saving: false});
            return;
        }

        if (Constants.SPECIAL_MENTIONS.includes(mention.toLowerCase())) {
            this.setState({mentionInputErrorText: Utils.localizeMessage('user_groups_modal.mentionReservedWord', 'Mention contains a reserved word.'), saving: false});
            return;
        }

        const mentionRegEx = new RegExp(/^[a-z0-9.\-_]+$/);
        if (!mentionRegEx.test(mention)) {
            this.setState({mentionInputErrorText: Utils.localizeMessage('user_groups_modal.mentionInvalidError', 'Invalid character in mention.'), saving: false});
            return;
        }

        const group = {
            name: mention,
            display_name: this.state.name,
            allow_reference: true,
            source: 'custom',
            user_ids: users.map((user) => {
                return user.id;
            }),
        };

        const data = await this.props.actions.createGroupWithUserIds(group);

        if (data?.error) {
            if (data.error?.server_error_id === 'app.custom_group.unique_name') {
                this.setState({mentionInputErrorText: Utils.localizeMessage('user_groups_modal.mentionNotUnique', 'Mention needs to be unique.')});
            } else if (data.error?.server_error_id === 'app.group.username_conflict') {
                this.setState({mentionInputErrorText: Utils.localizeMessage('user_groups_modal.mentionUsernameConflict', 'A username already exists with this name. Mention must be unique.')});
            } else {
                this.setState({showUnknownError: true});
            }
            this.setState({saving: false});
        } else if (typeof this.props.backButtonCallback === 'function') {
            this.goBack();
        } else {
            this.doHide();
        }
    }

    render() {
        return (
            <Modal
                dialogClassName='a11y__modal user-groups-modal-create'
                show={this.state.show}
                onHide={this.doHide}
                onExited={this.props.onExited}
                role='dialog'
                aria-labelledby='createUserGroupsModalLabel'
                id='createUserGroupsModal'
            >
                <Modal.Header closeButton={true}>
                    {
                        typeof this.props.backButtonCallback === 'function' ?
                            <>
                                <button
                                    type='button'
                                    className='modal-header-back-button btn-icon'
                                    aria-label='Back'
                                    onClick={() => {
                                        this.goBack();
                                    }}
                                >
                                    <LocalizedIcon
                                        className='icon icon-arrow-left'
                                        ariaLabel={{id: t('user_groups_modal.goBackLabel'), defaultMessage: 'Back'}}
                                    />
                                </button>
                                <Modal.Title
                                    componentClass='h1'
                                    id='createGroupsModalTitleWithBack'
                                >
                                    <FormattedMessage
                                        id='user_groups_modal.createTitle'
                                        defaultMessage='Create Group'
                                    />
                                </Modal.Title>
                            </> :
                            <Modal.Title
                                componentClass='h1'
                                id='createGroupsModalTitle'
                            >
                                <FormattedMessage
                                    id='user_groups_modal.createTitle'
                                    defaultMessage='Create Group'
                                />
                            </Modal.Title>
                    }

                </Modal.Header>
                <Modal.Body
                    className='overflow--visible'
                >
                    <div className='user-groups-modal__content'>
                        <div className='group-name-input-wrapper'>
                            <Input
                                type='text'
                                placeholder={Utils.localizeMessage('user_groups_modal.name', 'Name')}
                                onChange={this.updateNameState}
                                value={this.state.name}
                                data-testid='nameInput'
                                maxLength={64}
                                autoFocus={true}
                                customMessage={{type: ItemStatus.ERROR, value: this.state.nameInputErrorText}}
                            />
                        </div>
                        <div className='group-mention-input-wrapper'>
                            <Input
                                type='text'
                                placeholder={Utils.localizeMessage('user_groups_modal.mention', 'Mention')}
                                onChange={this.updateMentionState}
                                value={this.state.mention}
                                maxLength={64}
                                data-testid='mentionInput'
                                customMessage={{type: ItemStatus.ERROR, value: this.state.mentionInputErrorText}}
                            />
                        </div>
                        <h2>
                            <FormattedMessage
                                id='user_groups_modal.addPeople'
                                defaultMessage='Add People'
                            />
                        </h2>
                        <div className='group-add-user'>
                            <AddUserToGroupMultiSelect
                                multilSelectKey={'addUsersToGroupKey'}
                                onSubmitCallback={this.createGroup}
                                focusOnLoad={false}
                                savingEnabled={this.isSaveEnabled()}
                                addUserCallback={this.addUserCallback}
                                deleteUserCallback={this.deleteUserCallback}
                                backButtonText={localizeMessage('multiselect.cancelButton', 'Cancel')}
                                backButtonClick={
                                    typeof this.props.backButtonCallback === 'function' ?
                                        this.goBack :
                                        this.doHide
                                }
                                backButtonClass={'multiselect-back'}
                                saving={this.state.saving}
                            />
                        </div>
                        {
                            this.state.showUnknownError &&
                            <div className='Input___error group-error'>
                                <i className='icon icon-alert-outline'/>
                                <FormattedMessage
                                    id='user_groups_modal.unknownError'
                                    defaultMessage='An unknown error has occurred.'
                                />
                            </div>
                        }
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}
