// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel, ChannelMembership} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';
import {RelationOneToOne} from '@mattermost/types/utilities';
import React, {ChangeEvent, FormEvent} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {ActionResult} from 'mattermost-redux/types/actions';
import {getFullName} from 'mattermost-redux/utils/user_utils';

import ModalSuggestionList from 'components/suggestion/modal_suggestion_list';
import SearchChannelWithPermissionsProvider from 'components/suggestion/search_channel_with_permissions_provider';
import SuggestionBox from 'components/suggestion/suggestion_box';
import SuggestionBoxComponent from 'components/suggestion/suggestion_box/suggestion_box';

import {placeCaretAtEnd} from 'utils/utils';

export type Props = {

    /**
    * Function that's called after modal is closed
    */
    onExited: () => void;

    /**
    * The user that is being added to a channel
    */
    user: UserProfile;

    /**
    * Object used to determine if the user
    * is a member of a given channel
    */
    channelMembers: RelationOneToOne<Channel, Record<string, ChannelMembership>>;

    actions: {

        /**
        * Function to add the user to a channel
        */
        addChannelMember: (channelId: string, userId: string) => Promise<ActionResult>;

        /**
        * Function to fetch the user's channel membership
        */
        getChannelMember: (channelId: string, userId: string) => Promise<ActionResult>;

        /**
        * Function passed on to the constructor of the
        * SearchChannelWithPermissionsProvider class to fetch channels
        * based on a search term
        */
        autocompleteChannelsForSearch: (teamId: string, term: string) => Promise<ActionResult<Channel[]>>;
    };

}

type State = {

    /**
    * Whether or not the modal is visible
    */
    show: boolean;

    /**
    * Whether or not a request to add the user is in progress
    */
    saving: boolean;

    /**
    * Whether or not a request to check for the user's channel membership
    * is in progress
    */
    checkingForMembership: boolean;

    /**
    * The user input in the channel search box
    */
    text: string;

    /**
    * The id for the channel that is selected
    */
    selectedChannelId: string | null;

    /**
    * An error to display when the add request fails
    */
    submitError: string;
}

export default class AddUserToChannelModal extends React.PureComponent<Props, State> {
    private suggestionProviders: SearchChannelWithPermissionsProvider[];
    private channelSearchBox?: SuggestionBoxComponent;

    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
            saving: false,
            checkingForMembership: false,
            text: '',
            selectedChannelId: null,
            submitError: '',
        };
        this.suggestionProviders = [new SearchChannelWithPermissionsProvider(props.actions.autocompleteChannelsForSearch)];
        this.enableChannelProvider();
    }

    enableChannelProvider = () => {
        this.suggestionProviders[0].disableDispatches = false;
    };

    focusTextbox = () => {
        if (this.channelSearchBox == null) {
            return;
        }

        const textbox = this.channelSearchBox.getTextbox();
        if (document.activeElement !== textbox) {
            textbox.focus();
            placeCaretAtEnd(textbox);
        }
    };

    onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        this.setState({text: e.target.value, selectedChannelId: null});
    };

    onHide = () => {
        this.setState({show: false});
    };

    onExited = () => {
        this.props.onExited();
    };

    setSearchBoxRef = (input: SuggestionBoxComponent) => {
        this.channelSearchBox = input;
        this.focusTextbox();
    };

    handleSubmitError = (error: {message: string}) => {
        if (error) {
            this.setState({submitError: error.message, saving: false});
        }
    };

    didSelectChannel = (selection: {channel: Channel}) => {
        const channel = selection.channel;
        const userId = this.props.user.id;

        this.setState({
            text: channel.display_name,
            selectedChannelId: channel.id,
            checkingForMembership: true,
            submitError: '',
        });

        this.props.actions.getChannelMember(channel.id, userId).then(() => {
            this.setState({checkingForMembership: false});
        });
    };

    handleSubmit = (e: FormEvent) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        const channelId = this.state.selectedChannelId;
        const user = this.props.user;

        if (!channelId) {
            return;
        }

        if (this.isUserMemberOfChannel(channelId) || this.state.saving) {
            return;
        }

        this.setState({saving: true});

        this.props.actions.addChannelMember(channelId, user.id).then(({error}) => {
            if (error) {
                this.handleSubmitError(error);
            } else {
                this.onHide();
            }
        });
    };

    isUserMemberOfChannel = (channelId: string | null) => {
        const user = this.props.user;
        const memberships = this.props.channelMembers;

        if (!channelId) {
            return false;
        }

        if (!memberships[channelId]) {
            return false;
        }

        return Boolean(memberships[channelId][user.id]);
    };

    render() {
        const user = this.props.user;
        const channelId = this.state.selectedChannelId;
        const targetUserIsMemberOfSelectedChannel = this.isUserMemberOfChannel(channelId);

        let name = getFullName(user);
        if (!name) {
            name = `@${user.username}`;
        }

        let errorMsg;
        if (!this.state.saving) {
            if (this.state.submitError) {
                errorMsg = (
                    <label
                        id='add-user-to-channel-modal__invite-error'
                        className='modal__error has-error control-label'
                    >
                        {this.state.submitError}
                    </label>
                );
            } else if (targetUserIsMemberOfSelectedChannel) {
                errorMsg = (
                    <label
                        id='add-user-to-channel-modal__user-is-member'
                        className='modal__error has-error control-label'
                    >
                        <FormattedMessage
                            id='add_user_to_channel_modal.membershipExistsError'
                            defaultMessage='{name} is already a member of that channel'
                            values={{
                                name,
                            }}
                        />
                    </label>
                );
            }
        }

        const help = (
            <FormattedMessage
                id='add_user_to_channel_modal.help'
                defaultMessage='Type to find a channel. Use ↑↓ to browse, ↵ to select, ESC to dismiss.'
            />
        );

        const content = (
            <SuggestionBox
                ref={this.setSearchBoxRef}
                className='form-control focused'
                onChange={this.onInputChange}
                value={this.state.text}
                onItemSelected={this.didSelectChannel}
                listComponent={ModalSuggestionList}
                maxLength='64'
                providers={this.suggestionProviders}
                listPosition='bottom'
                completeOnTab={false}
                delayInputUpdate={true}
                openWhenEmpty={false}
            />
        );

        const shouldDisableAddButton = targetUserIsMemberOfSelectedChannel ||
            this.state.checkingForMembership ||
            Boolean(!this.state.selectedChannelId) ||
            this.state.saving;

        return (
            <Modal
                dialogClassName='a11y__modal modal--overflow'
                show={this.state.show}
                onHide={this.onHide}
                onExited={this.onExited}
                enforceFocus={true}
                role='dialog'
                aria-labelledby='addChannelModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='addChannelModalLabel'
                    >
                        <FormattedMessage
                            id='add_user_to_channel_modal.title'
                            defaultMessage='Add {name} to a Channel'
                            values={{
                                name,
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <form
                    role='form'
                    onSubmit={this.handleSubmit}
                >
                    <Modal.Body>
                        <div className='modal__hint'>
                            {help}
                        </div>
                        <div className='pos-relative'>
                            {content}
                        </div>
                        <div>
                            {errorMsg}
                            <br/>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type='button'
                            className='btn btn-link'
                            onClick={this.onHide}
                        >
                            <FormattedMessage
                                id='add_user_to_channel_modal.cancel'
                                defaultMessage='Cancel'
                            />
                        </button>
                        <button
                            type='button'
                            id='add-user-to-channel-modal__add-button'
                            className='btn btn-primary'
                            onClick={this.handleSubmit}
                            disabled={shouldDisableAddButton}
                        >
                            <FormattedMessage
                                id='add_user_to_channel_modal.add'
                                defaultMessage='Add'
                            />
                        </button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}
