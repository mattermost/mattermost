// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import NoResultsIndicator from 'components/no_results_indicator/no_results_indicator';
import {NoResultsVariant} from 'components/no_results_indicator/types';
import SuggestionBox from 'components/suggestion/suggestion_box';
import type SuggestionBoxComponent from 'components/suggestion/suggestion_box/suggestion_box';
import SuggestionList from 'components/suggestion/suggestion_list';
import {flattenItems, isItemLoaded, type SuggestionResults} from 'components/suggestion/suggestion_results';
import SwitchChannelProvider from 'components/suggestion/switch_channel_provider';

import {focusElement} from 'utils/a11y_utils';
import {getHistory} from 'utils/browser_history';
import Constants, {RHSStates} from 'utils/constants';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';

import type {RhsState} from 'types/store/rhs';

const CHANNEL_MODE = 'channel';

export type Props = WrappedComponentProps & {
    onExited: () => void;

    isMobileView: boolean;
    rhsState?: RhsState;
    rhsOpen?: boolean;

    actions: {
        joinChannelById: (channelId: string) => Promise<ActionResult>;
        switchToChannel: (channel: Channel) => Promise<ActionResult>;
        closeRightHandSide: () => void;
    };
    focusOriginElement: string;
};

type State = {
    text: string;
    mode: string | null;
    hasSuggestions: boolean;
    shouldShowLoadingSpinner: boolean;
    pretext: string;
};

export class QuickSwitchModal extends React.PureComponent<Props, State> {
    private channelProviders: SwitchChannelProvider[];
    private switchBox: SuggestionBoxComponent | null;

    constructor(props: Props) {
        super(props);

        this.channelProviders = [new SwitchChannelProvider()];
        this.switchBox = null;

        this.state = {
            text: '',
            mode: CHANNEL_MODE,
            hasSuggestions: true,
            shouldShowLoadingSpinner: true,
            pretext: '',
        };
    }

    private focusTextbox = (): void => {
        if (this.switchBox === null) {
            return;
        }
        const textbox = this.switchBox.getTextbox();
        if (document.activeElement !== textbox) {
            textbox.focus();
            Utils.placeCaretAtEnd(textbox);
        }
    };

    private setSwitchBoxRef = (input: SuggestionBoxComponent): void => {
        this.switchBox = input;
        this.focusTextbox();
    };

    private hideOnSelect = (): void => {
        this.focusPostTextbox();
        this.setState({
            text: '',
        });
        this.props.onExited();
    };

    private focusPostTextbox = (): void => {
        if (!UserAgent.isMobile()) {
            setTimeout(() => {
                const textbox = document.querySelector('#post_textbox') as HTMLElement;
                if (textbox) {
                    textbox.focus();
                }
            });
        }
    };

    private hideOnCancel = () => {
        this.props.onExited?.();
        focusElement(this.props.focusOriginElement, true);
    };

    private onChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({text: e.target.value, shouldShowLoadingSpinner: true});
    };

    public handleSubmit = async (selected?: any): Promise<void> => {
        if (!selected) {
            return;
        }

        if (this.props.rhsOpen && this.props.rhsState === RHSStates.EDIT_HISTORY) {
            this.props.actions.closeRightHandSide();
        }

        if (this.state.mode === CHANNEL_MODE) {
            const {joinChannelById, switchToChannel} = this.props.actions;
            const selectedChannel = selected.channel;

            if (selected.type === Constants.MENTION_MORE_CHANNELS && selectedChannel.type === Constants.OPEN_CHANNEL) {
                await joinChannelById(selectedChannel.id);
            }
            switchToChannel(selectedChannel).then((result: ActionResult) => {
                if ('data' in result) {
                    this.hideOnSelect();
                }
            });
        } else {
            getHistory().push('/' + selected.name);
            this.hideOnSelect();
        }
    };

    private handleSuggestionsReceived = (suggestions: SuggestionResults): void => {
        const suggestionItems = flattenItems(suggestions);
        const loadingPropPresent = suggestionItems.some((item) => !isItemLoaded(item));
        this.setState({
            shouldShowLoadingSpinner: loadingPropPresent,
            pretext: suggestions.matchedPretext,
            hasSuggestions: suggestionItems.length > 0,
        });
    };

    public render = (): JSX.Element => {
        const providers: SwitchChannelProvider[] = this.channelProviders;

        const header = (
            <h2 id='quickSwitchHeader'>
                <FormattedMessage
                    id='quick_switch_modal.switchChannels'
                    defaultMessage='Find Channels'
                />
            </h2>
        );

        let help: React.ReactNode;
        if (this.props.isMobileView) {
            help = (
                <FormattedMessage
                    id='quick_switch_modal.help_mobile'
                    defaultMessage='Type to find a channel.'
                />
            );
        } else {
            help = (
                <FormattedMessage
                    id='quickSwitchModal.help_no_team'
                    defaultMessage='Type to find a channel. Use <b>UP/DOWN</b> to browse, <b>ENTER</b> to select, <b>ESC</b> to dismiss.'
                    values={{
                        b: (chunks) => <b>{chunks}</b>,
                    }}
                />
            );
        }

        const modalHeaderText = (
            <div className='channel-switcher__header'>
                {header}
            </div>
        );

        const modalSubheaderText = (
            <div
                className='channel-switcher__hint'
                id='quickSwitchHint'
            >
                {help}
            </div>
        );

        return (
            <GenericModal
                className='a11y__modal channel-switcher'
                id='quickSwitchModal'
                show={true}
                bodyPadding={false}
                enforceFocus={false}
                onExited={this.hideOnCancel}
                onHide={this.hideOnCancel}
                ariaLabel={this.props.intl.formatMessage({id: 'quick_switch_modal.switchChannels', defaultMessage: 'Find Channels'})}
                modalHeaderText={modalHeaderText}
                modalSubheaderText={modalSubheaderText}
                compassDesign={true}
            >
                <div className='channel-switcher__suggestion-box'>
                    <i className='icon icon-magnify icon-16'/>
                    <SuggestionBox
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        ref={this.setSwitchBoxRef}
                        id='quickSwitchInput'
                        aria-label={this.props.intl.formatMessage({id: 'quick_switch_modal.input', defaultMessage: 'quick switch input'})}
                        className='form-control focused'
                        onChange={this.onChange}
                        value={this.state.text}
                        onItemSelected={this.handleSubmit}
                        listComponent={SuggestionList}
                        listPosition='bottom'
                        maxLength='64'
                        providers={providers}
                        completeOnTab={false}
                        spellCheck='false'
                        delayInputUpdate={true}
                        openWhenEmpty={true}
                        onSuggestionsReceived={this.handleSuggestionsReceived}
                        forceSuggestionsWhenBlur={true}
                        shouldSearchCompleteText={true}
                    />
                    {
                        !this.state.shouldShowLoadingSpinner &&
                        !this.state.hasSuggestions &&
                        this.state.text &&
                        (
                            <NoResultsIndicator
                                variant={NoResultsVariant.Search}
                                titleValues={{channelName: `${this.state.pretext}`}}
                            />
                        )
                    }
                </div>
            </GenericModal>
        );
    };
}

export default injectIntl(QuickSwitchModal);
