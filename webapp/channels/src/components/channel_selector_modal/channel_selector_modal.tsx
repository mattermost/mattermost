// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';
import {injectIntl, FormattedMessage, defineMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import MultiSelect from 'components/multiselect/multiselect';
import type {Value} from 'components/multiselect/multiselect';

import Constants from 'utils/constants';

import './channel_selector_modal.scss';

type ChannelWithTeamDataValue = ChannelWithTeamData & Value;

type Props = {
    searchTerm: string;
    onModalDismissed?: () => void;
    onChannelsSelected?: (channels: ChannelWithTeamData[]) => void;
    intl: IntlShape;
    groupID: string;
    actions: {
        loadChannels: (page?: number, perPage?: number, notAssociatedToGroup?: string, excludeDefaultChannels?: boolean, excludePolicyConstrained?: boolean, excludeAccessControlPolicyEnforced?: boolean) => Promise<ActionResult<ChannelWithTeamData[]>>;
        setModalSearchTerm: (term: string) => void;
        searchAllChannels: (term: string, opts?: ChannelSearchOpts) => Promise<ActionResult<ChannelWithTeamData[]>>;
    };
    alreadySelected?: string[];
    excludePolicyConstrained?: boolean;
    excludeAccessControlPolicyEnforced?: boolean;
    excludeGroupConstrained?: boolean;
    excludeDefaultChannels?: boolean;
    excludeTeamIds?: string[];
    excludeTypes?: string[];
    teamId?: string;
    excludeRemote?: boolean;
    customNoOptionsMessage?: React.ReactNode;
    isStacked?: boolean;
}

type State = {
    values: ChannelWithTeamDataValue[];
    show: boolean;
    search: boolean;
    loadingChannels: boolean;
    channels: ChannelWithTeamData[];
}

const CHANNELS_PER_PAGE = 50;

export class ChannelSelectorModal extends React.PureComponent<Props, State> {
    searchTimeoutId = 0;
    selectedItemRef = React.createRef<HTMLDivElement>();

    state: State = {
        values: [],
        show: true,
        search: false,
        loadingChannels: true,
        channels: [],
    };

    componentDidMount() {
        this.loadInitialChannels();
    }

    buildSearchOpts(): ChannelSearchOpts {
        const opts: ChannelSearchOpts = {};
        if (this.props.teamId) {
            opts.team_ids = [this.props.teamId];
            opts.nonAdminSearch = true;
        } else {
            opts.not_associated_to_group = this.props.groupID;
            opts.exclude_access_control_policy_enforced = this.props.excludeAccessControlPolicyEnforced;
        }
        const wantsPublic = !this.props.excludeTypes?.includes('O');
        const wantsPrivate = !this.props.excludeTypes?.includes('P');
        if (wantsPublic && !wantsPrivate) {
            opts.public = true;
        } else if (wantsPrivate && !wantsPublic) {
            opts.private = true;
        }
        if (this.props.excludeDefaultChannels) {
            opts.exclude_default_channels = true;
        }
        if (this.props.excludeRemote) {
            opts.exclude_remote = true;
        }
        return opts;
    }

    loadInitialChannels() {
        this.props.actions.searchAllChannels('', this.buildSearchOpts()).then((response) => {
            this.setState({channels: (response.data || []).sort(compareChannels)});
            this.setChannelsLoadingState(false);
        });
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.searchTerm !== this.props.searchTerm) {
            clearTimeout(this.searchTimeoutId);

            const searchTerm = this.props.searchTerm;
            if (searchTerm === '') {
                this.loadInitialChannels();
            } else {
                this.searchTimeoutId = window.setTimeout(
                    async () => {
                        this.setChannelsLoadingState(true);
                        const response = await this.props.actions.searchAllChannels(searchTerm, this.buildSearchOpts());
                        this.setState({channels: response.data!});
                        this.setChannelsLoadingState(false);
                    },
                    Constants.SEARCH_TIMEOUT_MILLISECONDS,
                );
            }
        }
    }

    handleHide = () => {
        this.props.actions.setModalSearchTerm('');
        this.setState({show: false});
    };

    handleExit = () => {
        if (this.props.onModalDismissed) {
            this.props.onModalDismissed();
        }
    };

    handleSubmit = (e: any) => {
        if (e) {
            e.preventDefault();
        }

        if (this.state.values.length === 0) {
            return;
        }

        if (this.props.onChannelsSelected) {
            this.props.onChannelsSelected(this.state.values);
        }
        this.handleHide();
    };

    addValue = (value: ChannelWithTeamDataValue) => {
        const values = [...this.state.values];
        if (value?.id && !values.some((v) => v.id === value.id)) {
            values.push(value);
        }

        this.setState({values});
    };

    setChannelsLoadingState = (loadingState: boolean) => {
        this.setState({
            loadingChannels: loadingState,
        });
    };

    handlePageChange = (page: number, prevPage: number) => {
        if (page > prevPage) {
            this.setChannelsLoadingState(true);
            this.props.actions.loadChannels(page, CHANNELS_PER_PAGE + 1, this.props.groupID, this.props.excludeDefaultChannels ?? false, this.props.excludePolicyConstrained, this.props.excludeAccessControlPolicyEnforced).then((response) => {
                const newState = [...this.state.channels];
                const stateChannelIDs = this.state.channels.map((stateChannel) => stateChannel.id);
                (response.data || []).forEach((serverChannel) => {
                    if (!stateChannelIDs.includes(serverChannel.id)) {
                        newState.push(serverChannel);
                    }
                });
                this.setState({channels: newState.sort(compareChannels)});
                this.setChannelsLoadingState(false);
            });
        }
    };

    handleDelete = (values: ChannelWithTeamDataValue[]) => {
        this.setState({values});
    };

    search = (term: string, multiselectComponent: MultiSelect<ChannelWithTeamDataValue>) => {
        if (multiselectComponent.state.page !== 0) {
            multiselectComponent.setState({page: 0});
        }
        this.props.actions.setModalSearchTerm(term);
    };

    renderOption = (
        option: ChannelWithTeamDataValue,
        isSelected: boolean,
        onAdd: (value: ChannelWithTeamDataValue) => void,
        onMouseMove: (value: ChannelWithTeamDataValue) => void) => {
        let rowSelected = '';
        if (isSelected) {
            rowSelected = 'more-modal__row--selected';
        }

        return (
            <div
                key={option.id}
                ref={isSelected ? this.selectedItemRef : option.id}
                className={'more-modal__row clickable ' + rowSelected}
                onClick={() => onAdd(option)}
                onMouseMove={() => onMouseMove(option)}
            >
                <div
                    className='more-modal__details'
                >
                    <div className='channel-info-block'>
                        {option.type === Constants.PRIVATE_CHANNEL &&
                            <i className='icon icon-lock-outline'/>}
                        {option.type === Constants.OPEN_CHANNEL &&
                            <i className='icon icon-globe'/>}
                        <span className='channel-name'>{option.display_name}</span>
                        {!this.props.teamId && option.team_display_name && (
                            <span className='team-name'>{'(' + option.team_display_name + ')'}</span>
                        )}
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <button
                        className='more-modal__actions--round'
                        aria-label='Select channel'
                    >
                        <i className='icon icon-plus'/>
                    </button>
                </div>
            </div>
        );
    };

    renderValue(props: {data: ChannelWithTeamDataValue}) {
        if (props.data.team_display_name) {
            return props.data.display_name + ' (' + props.data.team_display_name + ')';
        }
        return props.data.display_name;
    }

    render() {
        const numRemainingText = (
            <FormattedMessage
                id='multiselect.selectChannels'
                defaultMessage='Use ↑↓ to browse, ↵ to select.'
            />
        );

        const buttonSubmitText = defineMessage({id: 'multiselect.add', defaultMessage: 'Add'});

        let options = this.state.channels.map((i): ChannelWithTeamDataValue => ({...i, label: i.display_name, value: i.id}));
        if (this.props.alreadySelected) {
            options = options.filter((channel) => this.props.alreadySelected?.indexOf(channel.id) === -1);
        }
        if (this.props.excludePolicyConstrained) {
            options = options.filter((channel) => channel.policy_id === null);
        }
        if (this.props.excludeGroupConstrained) {
            options = options.filter((channel) => !channel.group_constrained);
        }
        if (this.props.excludeTeamIds) {
            options = options.filter((channel) => this.props.excludeTeamIds?.indexOf(channel.team_id) === -1);
        }
        if (this.props.excludeTypes) {
            options = options.filter((channel) => this.props.excludeTypes?.indexOf(channel.type) === -1);
        }
        if (this.props.excludeDefaultChannels) {
            // Belt-and-suspenders: the server honors exclude_default_channels on
            // the sysadmin search path, but the non-admin (team-scoped) path
            // uses AutocompleteChannelsForTeam which ignores it. Filter by the
            // canonical default-channel names client-side so both paths agree.
            options = options.filter((channel) => channel.name !== Constants.DEFAULT_CHANNEL && channel.name !== Constants.OFFTOPIC_CHANNEL);
        }
        const values = this.state.values.map((i): ChannelWithTeamDataValue => ({...i, label: i.display_name, value: i.id}));

        // Only show custom message when there are no options and user hasn't started searching
        // If user is searching (searchTerm exists), show the default "No results found matching..." message
        let customNoOptionsMessage;
        if (this.props.customNoOptionsMessage && !this.props.searchTerm) {
            customNoOptionsMessage = this.props.customNoOptionsMessage;
        }

        return (
            <GenericModal
                className='a11y__modal more-modal more-direct-channels channel-selector-modal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
                modalHeaderText={
                    <FormattedMessage
                        id='channelSelectorModal.title'
                        defaultMessage='Add Channels to <b>Channel Selection</b> List'
                        values={{
                            b: (chunks) => <b>{chunks}</b>,
                        }}
                    />
                }
                isStacked={this.props.isStacked}
                compassDesign={true}
                bodyPadding={false}
                id='channelSelectorModal'
            >
                <MultiSelect<ChannelWithTeamDataValue>
                    key='addChannelsToSchemeKey'
                    options={options}
                    optionRenderer={this.renderOption}
                    intl={this.props.intl}
                    selectedItemRef={this.selectedItemRef}
                    values={values}
                    valueRenderer={this.renderValue}
                    perPage={CHANNELS_PER_PAGE}
                    handlePageChange={this.handlePageChange}
                    handleInput={this.search}
                    handleDelete={this.handleDelete}
                    handleAdd={this.addValue}
                    handleSubmit={this.handleSubmit}
                    numRemainingText={numRemainingText}
                    buttonSubmitText={buttonSubmitText}
                    saving={false}
                    loading={this.state.loadingChannels}
                    placeholderText={defineMessage({id: 'multiselect.addChannelsPlaceholder', defaultMessage: 'Search and add channels'})}
                    customNoOptionsMessage={customNoOptionsMessage}
                />
            </GenericModal>
        );
    }
}

function compareChannels(a: Channel, b: Channel) {
    const aDisplayName = a.display_name.toUpperCase();
    const bDisplayName = b.display_name.toUpperCase();
    const result = aDisplayName.localeCompare(bDisplayName);
    if (result !== 0) {
        return result;
    }

    const aName = a.name.toUpperCase();
    const bName = b.name.toUpperCase();
    return aName.localeCompare(bName);
}

export default injectIntl(ChannelSelectorModal);
