// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EditChannelHeaderModal from './edit_channel_header_modal.jsx';
import EditChannelPurposeModal from './edit_channel_purpose_modal.jsx';
import MessageWrapper from './message_wrapper.jsx';
import NotifyCounts from './notify_counts.jsx';
import ChannelInfoModal from './channel_info_modal.jsx';
import ChannelInviteModal from './channel_invite_modal.jsx';
import ChannelNotificationsModal from './channel_notifications_modal.jsx';
import DeleteChannelModal from './delete_channel_modal.jsx';
import RenameChannelModal from './rename_channel_modal.jsx';
import ToggleModalButton from './toggle_modal_button.jsx';

import UserStore from '../stores/user_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import TeamStore from '../stores/team_store.jsx';

import * as Client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import * as Utils from '../utils/utils.jsx';

import Constants from '../utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';

import {FormattedMessage} from 'mm-intl';
import attachFastClick from 'fastclick';

const Popover = ReactBootstrap.Popover;
const OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class Navbar extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.showSearch = this.showSearch.bind(this);

        this.showEditChannelHeaderModal = this.showEditChannelHeaderModal.bind(this);
        this.showRenameChannelModal = this.showRenameChannelModal.bind(this);
        this.hideRenameChannelModal = this.hideRenameChannelModal.bind(this);

        this.createCollapseButtons = this.createCollapseButtons.bind(this);
        this.createDropdown = this.createDropdown.bind(this);

        const state = this.getStateFromStores();
        state.showEditChannelPurposeModal = false;
        state.showEditChannelHeaderModal = false;
        state.showMembersModal = false;
        state.showRenameChannelModal = false;
        this.state = state;
    }
    getStateFromStores() {
        return {
            channel: ChannelStore.getCurrent(),
            member: ChannelStore.getCurrentMember(),
            users: ChannelStore.getCurrentExtraInfo().members,
            currentUser: UserStore.getCurrentUser()
        };
    }
    stateValid() {
        return this.state.channel && this.state.member && this.state.users && this.state.currentUser;
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        ChannelStore.addExtraInfoChangeListener(this.onChange);
        $('.inner__wrap').click(this.hideSidebars);
        attachFastClick(document.body);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChange);
        ChannelStore.removeExtraInfoChangeListener(this.onChange);
    }
    handleSubmit(e) {
        e.preventDefault();
    }
    handleLeave() {
        Client.leaveChannel(this.state.channel.id,
            () => {
                AsyncClient.getChannels(true);
                window.location.href = TeamStore.getCurrentTeamUrl() + '/channels/town-square';
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleLeave');
            }
        );
    }
    hideSidebars(e) {
        var windowWidth = $(window).outerWidth();
        if (windowWidth <= 768) {
            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_SEARCH,
                results: null
            });

            AppDispatcher.handleServerAction({
                type: ActionTypes.RECEIVED_POST_SELECTED,
                postId: null
            });

            if (e.target.className !== 'navbar-toggle' && e.target.className !== 'icon-bar') {
                $('.inner__wrap').removeClass('move--right move--left move--left-small');
                $('.sidebar--left').removeClass('move--right');
                $('.sidebar--right').removeClass('move--left');
                $('.sidebar--menu').removeClass('move--left');
            }
        }
    }
    toggleLeftSidebar() {
        $('.inner__wrap').toggleClass('move--right');
        $('.sidebar--left').toggleClass('move--right');
    }
    toggleRightSidebar() {
        $('.inner__wrap').toggleClass('move--left-small');
        $('.sidebar--menu').toggleClass('move--left');
    }
    showSearch() {
        AppDispatcher.handleServerAction({
            type: ActionTypes.SHOW_SEARCH
        });
    }
    onChange() {
        this.setState(this.getStateFromStores());
        $('#navbar .navbar-brand .description').popover({placement: 'bottom', trigger: 'click', html: true});
    }
    showEditChannelHeaderModal() {
        // this can't be done using a ToggleModalButton because we can't use one inside an OverlayTrigger
        if (this.refs.headerOverlay) {
            this.refs.headerOverlay.hide();
        }

        this.setState({
            showEditChannelHeaderModal: true
        });
    }
    showRenameChannelModal(e) {
        e.preventDefault();

        this.setState({
            showRenameChannelModal: true
        });
    }
    hideRenameChannelModal() {
        this.setState({
            showRenameChannelModal: false
        });
    }
    createDropdown(channel, channelTitle, isAdmin, isDirect, popoverContent) {
        if (channel) {
            var viewInfoOption = (
                <li role='presentation'>
                    <ToggleModalButton
                        role='menuitem'
                        dialogType={ChannelInfoModal}
                        dialogProps={{channel}}
                    >
                        <FormattedMessage
                            id='navbar.viewInfo'
                            defaultMessage='View Info'
                        />
                    </ToggleModalButton>
                </li>
            );

            var setChannelHeaderOption = (
                <li role='presentation'>
                    <a
                        role='menuitem'
                        href='#'
                        onClick={this.showEditChannelHeaderModal}
                    >
                        <FormattedMessage
                            id='navbar.setHeader'
                            defaultMessage='Set Channel Header...'
                        />
                    </a>
                </li>
            );

            var setChannelPurposeOption = null;
            if (!isDirect) {
                setChannelPurposeOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            onClick={() => this.setState({showEditChannelPurposeModal: true})}
                        >
                            <FormattedMessage
                                id='navbar.setPurpose'
                                defaultMessage='Set Channel Purpose...'
                            />
                        </a>
                    </li>
                );
            }

            var addMembersOption;
            var leaveChannelOption;
            if (!isDirect && !ChannelStore.isDefault(channel)) {
                addMembersOption = (
                    <li role='presentation'>
                        <ToggleModalButton
                            role='menuitem'
                            dialogType={ChannelInviteModal}
                            dialogProps={{channel, currentUser: this.state.currentUser}}
                        >
                            <FormattedMessage
                                id='navbar.addMembers'
                                defaultMessage='Add Members'
                            />
                        </ToggleModalButton>
                    </li>
                );

                leaveChannelOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.handleLeave}
                        >
                            <FormattedMessage
                                id='navbar.leave'
                                defaultMessage='Leave Channel'
                            />
                        </a>
                    </li>
                );
            }

            var manageMembersOption;
            var renameChannelOption;
            var deleteChannelOption;
            if (!isDirect && isAdmin) {
                if (!ChannelStore.isDefault(channel)) {
                    manageMembersOption = (
                        <li role='presentation'>
                            <a
                                role='menuitem'
                                href='#'
                                onClick={() => this.setState({showMembersModal: true})}
                            >
                                <FormattedMessage
                                    id='navbar.manageMembers'
                                    defaultMessage='Manage Members'
                                />
                            </a>
                        </li>
                    );

                    deleteChannelOption = (
                        <li role='presentation'>
                            <ToggleModalButton
                                role='menuitem'
                                dialogType={DeleteChannelModal}
                                dialogProps={{channel}}
                            >
                                <FormattedMessage
                                    id='navbar.delete'
                                    defaultMessage='Delete Channel...'
                                />
                            </ToggleModalButton>
                        </li>
                    );
                }

                renameChannelOption = (
                    <li role='presentation'>
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.showRenameChannelModal}
                        >
                            <FormattedMessage
                                id='navbar.rename'
                                defaultMessage='Rename Channel...'
                            />
                        </a>
                    </li>
                );
            }

            var notificationPreferenceOption;
            if (!isDirect) {
                notificationPreferenceOption = (
                    <li role='presentation'>
                        <ToggleModalButton
                            role='menuitem'
                            dialogType={ChannelNotificationsModal}
                            dialogProps={{
                                channel,
                                channelMember: this.state.member,
                                currentUser: this.state.currentUser
                            }}
                        >
                            <FormattedMessage
                                id='navbar.preferences'
                                defaultMessage='Notification Preferences'
                            />
                        </ToggleModalButton>
                    </li>
                );
            }

            return (
                <div className='navbar-brand'>
                    <div className='dropdown'>
                        <OverlayTrigger
                            ref='headerOverlay'
                            trigger='click'
                            placement='bottom'
                            overlay={popoverContent}
                            className='description'
                            rootClose={true}
                        >
                            <div className='description info-popover'/>
                        </OverlayTrigger>
                        <a
                            href='#'
                            className='dropdown-toggle theme'
                            type='button'
                            data-toggle='dropdown'
                            aria-expanded='true'
                        >
                            <span className='heading'>{channelTitle} </span>
                            <span className='glyphicon glyphicon-chevron-down header-dropdown__icon'></span>
                        </a>
                        <ul
                            className='dropdown-menu'
                            role='menu'
                        >
                            {viewInfoOption}
                            {addMembersOption}
                            {manageMembersOption}
                            {setChannelHeaderOption}
                            {setChannelPurposeOption}
                            {notificationPreferenceOption}
                            {renameChannelOption}
                            {deleteChannelOption}
                            {leaveChannelOption}
                        </ul>
                    </div>
                </div>
            );
        }

        return (
            <div className='navbar-brand'>
                <a
                    href={TeamStore.getCurrentTeamUrl() + '/channels/town-square'}
                    className='heading'
                >
                    {channelTitle}
                </a>
            </div>
        );
    }
    createCollapseButtons(currentId) {
        var buttons = [];
        if (currentId == null) {
            buttons.push(
                <button
                    key='navbar-toggle-collapse'
                    type='button'
                    className='navbar-toggle'
                    data-toggle='collapse'
                    data-target='#navbar-collapse-1'
                >
                    <span className='sr-only'>
                        <FormattedMessage
                            id='navbar.toggle1'
                            defaultMessage='Toggle sidebar'
                        />
                    </span>
                    <span className='icon-bar'></span>
                    <span className='icon-bar'></span>
                    <span className='icon-bar'></span>
                </button>
            );
        } else {
            buttons.push(
                <button
                    key='navbar-toggle-sidebar'
                    type='button'
                    className='navbar-toggle'
                    data-toggle='collapse'
                    data-target='#sidebar-nav'
                    onClick={this.toggleLeftSidebar}
                >
                    <span className='sr-only'>
                        <FormattedMessage
                            id='navbar.toggle2'
                            defaultMessage='Toggle sidebar'
                        />
                    </span>
                    <span className='icon-bar'></span>
                    <span className='icon-bar'></span>
                    <span className='icon-bar'></span>
                    <NotifyCounts/>
                </button>
            );

            buttons.push(
                <button
                    key='navbar-toggle-menu'
                    type='button'
                    className='navbar-toggle menu-toggle pull-right'
                    data-toggle='collapse'
                    data-target='#sidebar-nav'
                    onClick={this.toggleRightSidebar}
                >
                    <span dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}}/>
                </button>
            );
        }

        return buttons;
    }
    render() {
        if (!this.stateValid()) {
            return null;
        }

        var currentId = this.state.currentUser.id;
        var channel = this.state.channel;
        var channelTitle = this.props.teamDisplayName;
        var popoverContent;
        var isAdmin = false;
        var isDirect = false;

        var editChannelHeaderModal = null;
        var editChannelPurposeModal = null;
        let renameChannelModal = null;

        if (channel) {
            popoverContent = (
                <Popover
                    bsStyle='info'
                    placement='bottom'
                    id='header-popover'
                >
                    <MessageWrapper
                        message={channel.header}
                        options={{singleline: true, mentionHighlight: false}}
                    />
                </Popover>
            );
            isAdmin = Utils.isAdmin(this.state.member.roles);

            if (channel.type === 'O') {
                channelTitle = channel.display_name;
            } else if (channel.type === 'P') {
                channelTitle = channel.display_name;
            } else if (channel.type === 'D') {
                isDirect = true;
                if (this.state.users.length > 1) {
                    let p;
                    if (this.state.users[0].id === currentId) {
                        p = UserStore.getProfile(this.state.users[1].id);
                    } else {
                        p = UserStore.getProfile(this.state.users[0].id);
                    }
                    if (p != null) {
                        channelTitle = p.username;
                    }
                }
            }

            if (channel.header.length === 0) {
                const link = (
                    <a
                        href='#'
                        onClick={this.showEditChannelHeaderModal}
                    >
                        <FormattedMessage
                            id='navbar.click'
                            defaultMessage='Click here'
                        />
                    </a>
                );
                popoverContent = (
                    <Popover
                        bsStyle='info'
                        placement='bottom'
                        id='header-popover'
                    >
                        <div>
                            <FormattedMessage
                                id='navbar.noHeader'
                                defaultMessage='No channel header yet.{newline}{link} to add one.'
                                values={{
                                    newline: (<br/>),
                                    link: (link)
                                }}
                            />
                        </div>
                    </Popover>
                );
            }

            editChannelHeaderModal = (
                <EditChannelHeaderModal
                    show={this.state.showEditChannelHeaderModal}
                    onHide={() => this.setState({showEditChannelHeaderModal: false})}
                    channel={channel}
                />
            );

            editChannelPurposeModal = (
                <EditChannelPurposeModal
                    show={this.state.showEditChannelPurposeModal}
                    onModalDismissed={() => this.setState({showEditChannelPurposeModal: false})}
                    channel={channel}
                />
            );

            renameChannelModal = (
                <RenameChannelModal
                    show={this.state.showRenameChannelModal}
                    onHide={this.hideRenameChannelModal}
                    channel={channel}
                />
            );
        }

        var collapseButtons = this.createCollapseButtons(currentId);

        const searchButton = (
            <button
                type='button'
                className='navbar-toggle pull-right'
                onClick={this.showSearch}
            >
                <span className='glyphicon glyphicon-search icon--white'/>
            </button>
        );

        var channelMenuDropdown = this.createDropdown(channel, channelTitle, isAdmin, isDirect, popoverContent);

        return (
            <div>
                <nav
                    className='navbar navbar-default navbar-fixed-top'
                    role='navigation'
                >
                    <div className='container-fluid theme'>
                        <div className='navbar-header'>
                            {collapseButtons}
                            {searchButton}
                            {channelMenuDropdown}
                        </div>
                    </div>
                </nav>
                {editChannelHeaderModal}
                {editChannelPurposeModal}
                {renameChannelModal}
            </div>
        );
    }
}

Navbar.defaultProps = {
    teamDisplayName: ''
};
Navbar.propTypes = {
    teamDisplayName: React.PropTypes.string
};
