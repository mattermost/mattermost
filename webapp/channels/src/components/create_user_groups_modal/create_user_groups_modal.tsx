// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage, type IntlShape, defineMessage, injectIntl} from 'react-intl';

import type {GroupCreateWithUserIds} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AddUserToGroupMultiSelect from 'components/add_user_to_group_multiselect';
import Input from 'components/widgets/inputs/input/input';

import Constants, {ItemStatus} from 'utils/constants';

import type {ModalData} from 'types/actions';

import 'components/user_groups_modal/user_groups_modal.scss';
import './create_user_groups_modal.scss';

export type Props = {
    onExited: () => void;
    backButtonCallback?: () => void;
    actions: {
        createGroupWithUserIds: (group: GroupCreateWithUserIds) => Promise<ActionResult>;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
    intl: IntlShape;
}

type State = {
    show: boolean;
    name: string;
    mention: string;
    savingEnabled: boolean;
    usersToAdd: UserProfile[];
    mentionUpdatedManually: boolean;
    mentionInputErrorText: React.ReactNode;
    nameInputErrorText: React.ReactNode;
    showUnknownError: boolean;
    saving: boolean;
}

export class CreateUserGroupsModal extends React.PureComponent<Props, State> {
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
    };
    isSaveEnabled = () => {
        return this.state.name.length > 0 && this.state.mention.length > 0 && this.state.usersToAdd.length > 0;
    };
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
    };

    updateMentionState = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        this.setState({mention: value, mentionUpdatedManually: true});
    };

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
    };

    createGroup = async (users?: UserProfile[]) => {
        this.setState({showUnknownError: false, mentionInputErrorText: '', nameInputErrorText: '', saving: true});
        let mention = this.state.mention;
        const displayName = this.state.name;

        if (!displayName || !displayName.trim()) {
            this.setState({
                nameInputErrorText: (
                    <FormattedMessage
                        id='user_groups_modal.nameIsEmpty'
                        defaultMessage='Name is a required field.'
                    />
                ),
                saving: false,
            });
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
            this.setState({
                mentionInputErrorText: (
                    <FormattedMessage
                        id='user_groups_modal.mentionIsEmpty'
                        defaultMessage='Mention is a required field.'
                    />
                ),
                saving: false,
            });
            return;
        }

        if (Constants.SPECIAL_MENTIONS.includes(mention.toLowerCase())) {
            this.setState({
                mentionInputErrorText: (
                    <FormattedMessage
                        id='user_groups_modal.mentionReservedWord'
                        defaultMessage='Mention contains a reserved word.'
                    />
                ),
                saving: false,
            });
            return;
        }

        const mentionRegEx = new RegExp(/^[a-z0-9.\-_]+$/);
        if (!mentionRegEx.test(mention)) {
            this.setState({
                mentionInputErrorText: (
                    <FormattedMessage
                        id='user_groups_modal.mentionInvalidError'
                        defaultMessage='Invalid character in mention.'
                    />
                ),
                saving: false,
            });
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
                this.setState({
                    mentionInputErrorText: (
                        <FormattedMessage
                            id='user_groups_modal.mentionNotUnique'
                            defaultMessage='Mention needs to be unique.'
                        />
                    ),
                });
            } else if (data.error?.server_error_id === 'app.group.username_conflict') {
                this.setState({
                    mentionInputErrorText: (
                        <FormattedMessage
                            id='user_groups_modal.mentionUsernameConflict'
                            defaultMessage='A username already exists with this name. Mention must be unique.'
                        />
                    ),
                });
            } else {
                this.setState({showUnknownError: true});
            }
            this.setState({saving: false});
        } else if (typeof this.props.backButtonCallback === 'function') {
            this.goBack();
        } else {
            this.doHide();
        }
    };

    render() {
        return (
            <Modal
                dialogClassName='a11y__modal user-groups-modal-create'
                show={this.state.show}
                onHide={this.doHide}
                onExited={this.props.onExited}
                role='none'
                aria-labelledby='createUserGroupsModalLabel'
                id='createUserGroupsModal'
            >
                <Modal.Header closeButton={true}>
                    {
                        typeof this.props.backButtonCallback === 'function' ? (
                            <div className='d-flex align-items-center'>
                                <button
                                    type='button'
                                    className='modal-header-back-button btn btn-icon'
                                    aria-label={this.props.intl.formatMessage({id: 'user_groups_modal.goBackLabel', defaultMessage: 'Back'})}
                                    onClick={() => {
                                        this.goBack();
                                    }}
                                >
                                    <i className='icon icon-arrow-left'/>
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
                            </div>
                        ) : (
                            <Modal.Title
                                componentClass='h1'
                                id='createGroupsModalTitle'
                            >
                                <FormattedMessage
                                    id='user_groups_modal.createTitle'
                                    defaultMessage='Create Group'
                                />
                            </Modal.Title>
                        )
                    }

                </Modal.Header>
                <Modal.Body>
                    <div className='user-groups-modal__content'>
                        <div className='group-name-input-wrapper'>
                            <Input
                                type='text'
                                placeholder={defineMessage({id: 'user_groups_modal.name', defaultMessage: 'Name'})}
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
                                placeholder={defineMessage({id: 'user_groups_modal.mention', defaultMessage: 'Mention'})}
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
                                backButtonText={defineMessage({id: 'multiselect.cancelButton', defaultMessage: 'Cancel'})}
                                backButtonClick={
                                    typeof this.props.backButtonCallback === 'function' ? this.goBack : this.doHide
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

export default injectIntl(CreateUserGroupsModal);
