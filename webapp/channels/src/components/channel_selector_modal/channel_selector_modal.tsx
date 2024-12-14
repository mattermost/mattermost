// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import type {IntlShape} from 'react-intl';
import {injectIntl, FormattedMessage, defineMessage} from 'react-intl';

import type {Channel, ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import MultiSelect from 'components/multiselect/multiselect';
import type {Value} from 'components/multiselect/multiselect';

import Constants from 'utils/constants';

type ChannelWithTeamDataValue = ChannelWithTeamData & Value;

type Props = {
    searchTerm: string;
    onModalDismissed?: () => void;
    onChannelsSelected?: (channels: ChannelWithTeamData[]) => void;
    intl: IntlShape;
    groupID: string;
    actions: {
        loadChannels: (page?: number, perPage?: number, notAssociatedToGroup?: string, excludeDefaultChannels?: boolean, excludePolicyConstrained?: boolean) => Promise<ActionResult<ChannelWithTeamData[]>>;
        setModalSearchTerm: (term: string) => void;
        searchAllChannels: (term: string, opts?: ChannelSearchOpts) => Promise<ActionResult<ChannelWithTeamData[]>>;
    };
    alreadySelected?: string[];
    excludePolicyConstrained?: boolean;
    excludeTeamIds?: string[];
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
        this.props.actions.loadChannels(0, CHANNELS_PER_PAGE + 1, this.props.groupID, false, this.props.excludePolicyConstrained).then((response) => {
            this.setState({channels: response.data!.sort(compareChannels)});
            this.setChannelsLoadingState(false);
        });
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.searchTerm !== this.props.searchTerm) {
            clearTimeout(this.searchTimeoutId);

            const searchTerm = this.props.searchTerm;
            if (searchTerm === '') {
                this.props.actions.loadChannels(0, CHANNELS_PER_PAGE + 1, this.props.groupID, false, this.props.excludePolicyConstrained).then((response) => {
                    this.setState({channels: response.data!.sort(compareChannels)});
                    this.setChannelsLoadingState(false);
                });
            } else {
                this.searchTimeoutId = window.setTimeout(
                    async () => {
                        this.setChannelsLoadingState(true);
                        const response = await this.props.actions.searchAllChannels(searchTerm, {not_associated_to_group: this.props.groupID});
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
            this.props.actions.loadChannels(page, CHANNELS_PER_PAGE + 1, this.props.groupID, false, this.props.excludePolicyConstrained).then((response) => {
                const newState = [...this.state.channels];
                const stateChannelIDs = this.state.channels.map((stateChannel) => stateChannel.id);
                response.data!.forEach((serverChannel) => {
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
                        <span className='team-name'>{'(' + option.team_display_name + ')'}</span>
                    </div>
                </div>
                <div className='more-modal__actions'>
                    <div className='more-modal__actions--round'>
                        <i className='icon icon-plus'/>
                    </div>
                </div>
            </div>
        );
    };

    renderValue(props: {data: ChannelWithTeamDataValue}) {
        return props.data.display_name + ' (' + props.data.team_display_name + ')';
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
        if (this.props.excludeTeamIds) {
            options = options.filter((channel) => this.props.excludeTeamIds?.indexOf(channel.team_id) === -1);
        }
        const values = this.state.values.map((i): ChannelWithTeamDataValue => ({...i, label: i.display_name, value: i.id}));

        return (
            <Modal
                dialogClassName={'a11y__modal more-modal more-direct-channels channel-selector-modal'}
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
                role='none'
                aria-labelledby='channelSelectorModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='channelSelectorModalLabel'
                    >
                        <FormattedMessage
                            id='channelSelectorModal.title'
                            defaultMessage='Add Channels to <b>Channel Selection</b> List'
                            values={{
                                b: (chunks: string) => <b>{chunks}</b>,
                            }}
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
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
                    />
                </Modal.Body>
            </Modal>
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
