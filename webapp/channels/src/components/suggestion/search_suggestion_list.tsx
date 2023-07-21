// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Popover from 'components/widgets/popover';

import Constants from 'utils/constants';

import {UserProfile} from './command_provider/app_command_parser/app_command_parser_dependencies';
import SuggestionList from './suggestion_list';

interface Item extends UserProfile {
    type: string;
    display_name: string;
    name: string;
}

interface Props {
    ariaLiveRef?: React.RefObject<HTMLDivElement>;
    inputRef?: React.RefObject<HTMLInputElement>;
    open: boolean;
    position?: 'top' | 'bottom';
    renderDividers?: string[];
    renderNoResults?: boolean;
    onCompleteWord: (term: string, matchedPretext: string, e?: React.KeyboardEventHandler<HTMLDivElement>) => boolean;
    preventClose?: () => void;
    onItemHover: (term: string) => void;
    pretext: string;
    cleared: boolean;
    matchedPretext: string[];
    items: any[];
    terms: string[];
    selection: string;
    components: Array<React.FunctionComponent<any>>;
    wrapperHeight?: number;

    // suggestionBoxAlgn is an optional object that can be passed to align the SuggestionList with the keyboard caret
    // as the user is typing.
    suggestionBoxAlgn?: {
        lineHeight: number;
        pixelsToMoveX: number;
        pixelsToMoveY: number;
    };
}

export default class SearchSuggestionList extends SuggestionList {
    popoverRef: React.RefObject<Popover>;
    itemsContainerRef: React.RefObject<HTMLDivElement>;
    suggestionReadOut: React.RefObject<HTMLDivElement>;
    currentLabel: string;

    constructor(props: Props) {
        super(props);

        this.popoverRef = React.createRef();
        this.itemsContainerRef = React.createRef();
        this.suggestionReadOut = React.createRef();
        this.currentLabel = '';
    }

    generateLabel(item: Item) {
        if (item.username) {
            this.currentLabel = item.username;
            if ((item.first_name || item.last_name) && item.nickname) {
                this.currentLabel += ` ${item.first_name} ${item.last_name} ${item.nickname}`;
            } else if (item.nickname) {
                this.currentLabel += ` ${item.nickname}`;
            } else if (item.first_name || item.last_name) {
                this.currentLabel += ` ${item.first_name} ${item.last_name}`;
            }
        } else if (item.type === Constants.DM_CHANNEL || item.type === Constants.GM_CHANNEL) {
            this.currentLabel = item.display_name;
        } else {
            this.currentLabel = item.name;
        }

        if (this.currentLabel) {
            this.currentLabel = this.currentLabel.toLowerCase();
        }

        this.announceLabel();
    }

    getContent = () => {
        return this.itemsContainerRef?.current?.parentNode as HTMLDivElement | null;
    };

    renderChannelDivider(type: string) {
        let text;
        if (type === Constants.OPEN_CHANNEL) {
            text = (
                <FormattedMessage
                    id='suggestion.search.public'
                    defaultMessage='Public Channels'
                />
            );
        } else if (type === Constants.PRIVATE_CHANNEL) {
            text = (
                <FormattedMessage
                    id='suggestion.search.private'
                    defaultMessage='Private Channels'
                />
            );
        } else {
            text = (
                <FormattedMessage
                    id='suggestion.search.direct'
                    defaultMessage='Direct Messages'
                />
            );
        }

        return (
            <div
                key={type + '-divider'}
                className='search-autocomplete__divider'
            >
                <span>{text}</span>
            </div>
        );
    }

    render() {
        if (this.props.items.length === 0) {
            return null;
        }

        const items: JSX.Element[] = [];
        let haveDMDivider = false;
        for (let i = 0; i < this.props.items.length; i++) {
            const item: any = this.props.items[i];
            const term = this.props.terms[i];
            const isSelection = term === this.props.selection;

            // ReactComponent names need to be upper case when used in JSX
            const Component = this.props.components[i];

            // temporary hack to add dividers between public and private channels in the search suggestion list
            if (this.props.renderDividers) {
                if (i === 0 || item.type !== this.props.items[i - 1].type) {
                    if (item.type === Constants.DM_CHANNEL || item.type === Constants.GM_CHANNEL) {
                        if (!haveDMDivider) {
                            items.push(this.renderChannelDivider(Constants.DM_CHANNEL));
                        }
                        haveDMDivider = true;
                    } else if (item.type === Constants.PRIVATE_CHANNEL) {
                        items.push(this.renderChannelDivider(Constants.PRIVATE_CHANNEL));
                    } else if (item.type === Constants.OPEN_CHANNEL) {
                        items.push(this.renderChannelDivider(Constants.OPEN_CHANNEL));
                    }
                }
            }

            if (isSelection) {
                this.currentItem = item;
            }

            items.push(
                <Component
                    key={term}
                    ref={(ref: React.RefObject<HTMLDivElement>) => this.itemRefs.set(term, ref)}
                    item={item}
                    term={term}
                    matchedPretext={this.props.matchedPretext[i]}
                    isSelection={isSelection}
                    onClick={this.props.onCompleteWord}
                    onMouseMove={this.props.onItemHover}
                />,
            );
        }

        return (
            <Popover
                ref={this.popoverRef}
                id='search-autocomplete__popover'
                className='search-help-popover autocomplete visible'
                placement='bottom'
            >
                <div
                    ref={this.suggestionReadOut}
                    aria-live='polite'
                    className='hidden-label'
                />
                <div ref={this.itemsContainerRef}>
                    {items}
                </div>
            </Popover>
        );
    }
}
