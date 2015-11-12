// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const NavbarSearchBox = require('./search_bar.jsx');
const MessageWrapper = require('./message_wrapper.jsx');
const PopoverListMembers = require('./popover_list_members.jsx');
const EditChannelPurposeModal = require('./edit_channel_purpose_modal.jsx');
const ChannelInviteModal = require('./channel_invite_modal.jsx');
const ChannelMembersModal = require('./channel_members_modal.jsx');

const ChannelStore = require('../stores/channel_store.jsx');
const UserStore = require('../stores/user_store.jsx');
const SearchStore = require('../stores/search_store.jsx');
const PreferenceStore = require('../stores/preference_store.jsx');

const AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
const Utils = require('../utils/utils.jsx');
const TextFormatting = require('../utils/text_formatting.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const Client = require('../utils/client.jsx');
const Constants = require('../utils/constants.jsx');
const ActionTypes = Constants.ActionTypes;

const Popover = ReactBootstrap.Popover;
const OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class ChannelHeader extends React.Component {
    constructor(props) {
        super(props);

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleLeave = this.handleLeave.bind(this);
        this.searchMentions = this.searchMentions.bind(this);

        const state = this.getStateFromStores();
        state.showEditChannelPurposeModal = false;
        state.showInviteModal = false;
        state.showMembersModal = false;
        this.state = state;
    }
    getStateFromStores() {
        const extraInfo = ChannelStore.getCurrentExtraInfo();

        return {
            channel: ChannelStore.getCurrent(),
            memberChannel: ChannelStore.getCurrentMember(),
            memberTeam: UserStore.getCurrentUser(),
            users: extraInfo.members,
            userCount: extraInfo.member_count,
            searchVisible: SearchStore.getSearchResults() !== null
        };
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onListenerChange);
        ChannelStore.addExtraInfoChangeListener(this.onListenerChange);
        SearchStore.addSearchChangeListener(this.onListenerChange);
        UserStore.addChangeListener(this.onListenerChange);
        PreferenceStore.addChangeListener(this.onListenerChange);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onListenerChange);
        ChannelStore.removeExtraInfoChangeListener(this.onListenerChange);
        SearchStore.removeSearchChangeListener(this.onListenerChange);
        UserStore.removeChangeListener(this.onListenerChange);
        PreferenceStore.removeChangeListener(this.onListenerChange);
    }
    onListenerChange() {
        const newState = this.getStateFromStores();
        if (!Utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
        $('.channel-header__info .description').popover({placement: 'bottom', trigger: 'hover', html: true, delay: {show: 500, hide: 500}});
    }
    handleLeave() {
        Client.leaveChannel(this.state.channel.id,
            () => {
                AppDispatcher.handleViewAction({
                    type: ActionTypes.LEAVE_CHANNEL,
                    id: this.state.channel.id
                });

                const townsquare = ChannelStore.getByName('town-square');
                Utils.switchChannel(townsquare);
            },
            (err) => {
                AsyncClient.dispatchError(err, 'handleLeave');
            }
        );
    }
    searchMentions(e) {
        e.preventDefault();

        const user = UserStore.getCurrentUser();

        let terms = '';
        if (user.notify_props && user.notify_props.mention_keys) {
            const termKeys = UserStore.getCurrentMentionKeys();
            if (user.notify_props.all === 'true' && termKeys.indexOf('@all') !== -1) {
                termKeys.splice(termKeys.indexOf('@all'), 1);
            }
            if (user.notify_props.channel === 'true' && termKeys.indexOf('@channel') !== -1) {
                termKeys.splice(termKeys.indexOf('@channel'), 1);
            }
            terms = termKeys.join(' ');
        }

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH_TERM,
            term: terms,
            do_search: true,
            is_mention_search: true
        });
    }
    render() {
        if (this.state.channel === null) {
            return null;
        }

        const channel = this.state.channel;
        const popoverContent = (
            <Popover
                id='hader-popover'
                bStyle='info'
                bSize='large'
                placement='bottom'
                className='description'
                onMouseOver={() => this.refs.headerOverlay.show()}
                onMouseOut={() => this.refs.headerOverlay.hide()}
            >
                <MessageWrapper
                    message={channel.header}
                />
            </Popover>
        );
        let channelTitle = channel.display_name;
        const currentId = UserStore.getCurrentId();
        const isAdmin = Utils.isAdmin(this.state.memberChannel.roles) || Utils.isAdmin(this.state.memberTeam.roles);
        const isDirect = (this.state.channel.type === 'D');

        if (isDirect) {
            if (this.state.users.length > 1) {
                let contact;
                if (this.state.users[0].id === currentId) {
                    contact = this.state.users[1];
                } else {
                    contact = this.state.users[0];
                }
                channelTitle = Utils.displayUsername(contact.id);
            }
        }

        let channelTerm = 'Channel';
        if (channel.type === 'P') {
            channelTerm = 'Group';
        }

        const dropdownContents = [];
        if (isDirect) {
            dropdownContents.push(
                <li
                    key='edit_header_direct'
                    role='presentation'
                >
                    <a
                        role='menuitem'
                        href='#'
                        data-toggle='modal'
                        data-target='#edit_channel'
                        data-header={channel.header}
                        data-title={channel.display_name}
                        data-channelid={channel.id}
                    >
                        {'Set Channel Header...'}
                    </a>
                </li>
            );
        } else {
            dropdownContents.push(
                <li
                    key='view_info'
                    role='presentation'
                >
                    <a
                        role='menuitem'
                        data-toggle='modal'
                        data-target='#channel_info'
                        data-channelid={channel.id}
                        href='#'
                    >
                        {'View Info'}
                    </a>
                </li>
            );

            if (!ChannelStore.isDefault(channel)) {
                dropdownContents.push(
                    <li
                        key='add_members'
                        role='presentation'
                    >
                        <a
                            role='menuitem'
                            href='#'
                            onClick={() => this.setState({showInviteModal: true})}
                        >
                            {'Add Members'}
                        </a>
                    </li>
                );

                if (isAdmin) {
                    dropdownContents.push(
                        <li
                            key='manage_members'
                            role='presentation'
                        >
                            <a
                                role='menuitem'
                                href='#'
                                onClick={() => this.setState({showMembersModal: true})}
                            >
                                {'Manage Members'}
                            </a>
                        </li>
                    );
                }
            }

            dropdownContents.push(
                <li
                    key='set_channel_header'
                    role='presentation'
                >
                    <a
                        role='menuitem'
                        href='#'
                        data-toggle='modal'
                        data-target='#edit_channel'
                        data-header={channel.header}
                        data-title={channel.display_name}
                        data-channelid={channel.id}
                    >
                        {'Set '}{channelTerm}{' Header...'}
                    </a>
                </li>
            );
            dropdownContents.push(
                <li
                    key='set_channel_purpose'
                    role='presentation'
                >
                    <a
                        role='menuitem'
                        href='#'
                        onClick={() => this.setState({showEditChannelPurposeModal: true})}
                    >
                        {'Set '}{channelTerm}{' Purpose...'}
                    </a>
                </li>
            );
            dropdownContents.push(
                <li
                    key='notification_preferences'
                    role='presentation'
                >
                    <a
                        role='menuitem'
                        href='#'
                        data-toggle='modal'
                        data-target='#channel_notifications'
                        data-title={channel.display_name}
                        data-channelid={channel.id}
                    >
                        {'Notification Preferences'}
                    </a>
                </li>
            );

            if (!ChannelStore.isDefault(channel)) {
                if (isAdmin) {
                    dropdownContents.push(
                        <li
                            key='rename_channel'
                            role='presentation'
                        >
                            <a
                                role='menuitem'
                                href='#'
                                data-toggle='modal'
                                data-target='#rename_channel'
                                data-display={channel.display_name}
                                data-name={channel.name}
                                data-channelid={channel.id}
                            >
                                {'Rename '}{channelTerm}{'...'}
                            </a>
                        </li>
                    );
                    dropdownContents.push(
                        <li
                            key='delete_channel'
                            role='presentation'
                        >
                            <a
                                role='menuitem'
                                href='#'
                                data-toggle='modal'
                                data-target='#delete_channel'
                                data-title={channel.display_name}
                                data-channelid={channel.id}
                            >
                                {'Delete '}{channelTerm}{'...'}
                            </a>
                        </li>
                    );
                }

                dropdownContents.push(
                    <li
                        key='leave_channel'
                        role='presentation'
                    >
                        <a
                            role='menuitem'
                            href='#'
                            onClick={this.handleLeave}
                        >
                            {'Leave '}{channelTerm}
                        </a>
                    </li>
                );
            }
        }

        return (
            <div>
                <table className='channel-header alt'>
                    <tbody>
                        <tr>
                            <th>
                                <div className='channel-header__info'>
                                    <div className='dropdown'>
                                        <a
                                            href='#'
                                            className='dropdown-toggle theme'
                                            type='button'
                                            id='channel_header_dropdown'
                                            data-toggle='dropdown'
                                            aria-expanded='true'
                                        >
                                            <strong className='heading'>{channelTitle} </strong>
                                            <span className='glyphicon glyphicon-chevron-down header-dropdown__icon' />
                                        </a>
                                        <ul
                                            className='dropdown-menu'
                                            role='menu'
                                            aria-labelledby='channel_header_dropdown'
                                        >
                                            {dropdownContents}
                                        </ul>
                                    </div>
                                    <OverlayTrigger
                                        trigger={['hover', 'focus']}
                                        placement='bottom'
                                        overlay={popoverContent}
                                        ref='headerOverlay'
                                    >
                                    <div
                                        onClick={TextFormatting.handleClick}
                                        className='description'
                                        dangerouslySetInnerHTML={{__html: TextFormatting.formatText(channel.header, {singleline: true, mentionHighlight: false})}}
                                    />
                                    </OverlayTrigger>
                                </div>
                            </th>
                            <th>
                                <PopoverListMembers
                                    members={this.state.users}
                                    memberCount={this.state.userCount}
                                    channelId={channel.id}
                                />
                            </th>
                            <th className='search-bar__container'><NavbarSearchBox /></th>
                            <th>
                                <div className='dropdown channel-header__links'>
                                    <a
                                        href='#'
                                        className='dropdown-toggle theme'
                                        type='button'
                                        id='channel_header_right_dropdown'
                                        data-toggle='dropdown'
                                        aria-expanded='true'
                                    >
                                        <span dangerouslySetInnerHTML={{__html: Constants.MENU_ICON}} />
                                    </a>
                                    <ul
                                        className='dropdown-menu dropdown-menu-right'
                                        role='menu'
                                        aria-labelledby='channel_header_right_dropdown'
                                    >
                                        <li role='presentation'>
                                            <a
                                                role='menuitem'
                                                href='#'
                                                onClick={this.searchMentions}
                                            >
                                                {'Recent Mentions'}
                                            </a>
                                        </li>
                                    </ul>
                                </div>
                            </th>
                        </tr>
                    </tbody>
                </table>
                <EditChannelPurposeModal
                    show={this.state.showEditChannelPurposeModal}
                    onModalDismissed={() => this.setState({showEditChannelPurposeModal: false})}
                    channel={channel}
                />
                <ChannelInviteModal
                    show={this.state.showInviteModal}
                    onModalDismissed={() => this.setState({showInviteModal: false})}
                />
                <ChannelMembersModal
                    show={this.state.showMembersModal}
                    onModalDismissed={() => this.setState({showMembersModal: false})}
                />
            </div>
        );
    }
}
