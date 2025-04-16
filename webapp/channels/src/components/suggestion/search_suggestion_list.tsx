// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {Popover as BSPopover} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import Popover from 'components/widgets/popover';

import Constants from 'utils/constants';

import type {Props} from './suggestion_list';
import SuggestionList from './suggestion_list';

export default class SearchSuggestionList extends SuggestionList {
    popoverRef: React.RefObject<BSPopover>;
    itemsContainerRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.popoverRef = React.createRef();
        this.itemsContainerRef = React.createRef();
    }

    getContent = () => {
        return this.itemsContainerRef?.current?.parentNode as HTMLUListElement | null;
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

            items.push(
                <Component
                    key={term}
                    id={`sbrSearchBox_item_${term}`}
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
                <div ref={this.itemsContainerRef}>
                    {items}
                </div>
            </Popover>
        );
    }
}
