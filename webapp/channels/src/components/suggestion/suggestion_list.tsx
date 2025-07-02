// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {Constants} from 'utils/constants';

export interface Props {
    inputRef?: React.RefObject<HTMLDivElement>;
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
    components: Array<React.ComponentType<any>>;
    wrapperHeight?: number;

    // suggestionBoxAlgn is an optional object that can be passed to align the SuggestionList with the keyboard caret
    // as the user is typing.
    suggestionBoxAlgn?: {
        lineHeight?: number;
        pixelsToMoveX?: number;
        pixelsToMoveY?: number;
    };
}

export default class SuggestionList extends React.PureComponent<Props> {
    static defaultProps = {
        renderDividers: [],
        renderNoResults: false,
    };
    contentRef: React.RefObject<HTMLUListElement>;
    wrapperRef: React.RefObject<HTMLDivElement>;
    itemRefs: Map<string, HTMLElement>;
    maxHeight: number;

    constructor(props: Props) {
        super(props);

        this.contentRef = React.createRef();
        this.wrapperRef = React.createRef();
        this.itemRefs = new Map();
        this.maxHeight = 0;
    }

    componentDidMount() {
        this.updateMaxHeight();
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.selection !== prevProps.selection && this.props.selection) {
            this.scrollToItem(this.props.selection);
        }

        if (this.props.items.length > 0 && prevProps.items.length === 0) {
            this.updateMaxHeight();
        }
    }

    updateMaxHeight = () => {
        if (!this.props.inputRef?.current) {
            return;
        }

        const inputHeight = (this.props.inputRef as React.RefObject<HTMLInputElement>).current?.clientHeight ?? 0;

        this.maxHeight = Math.min(
            window.innerHeight - (inputHeight + Constants.POST_MODAL_PADDING),
            Constants.SUGGESTION_LIST_MAXHEIGHT,
        );

        if (this.contentRef.current) {
            this.contentRef.current.style.maxHeight = `${this.maxHeight}px`;
        }
    };

    getContent = () => {
        return this.contentRef.current;
    };

    scrollToItem = (term: string) => {
        const content = this.getContent();
        if (!content) {
            return;
        }

        const visibleContentHeight = content.clientHeight;
        const actualContentHeight = content.scrollHeight;

        if (visibleContentHeight < actualContentHeight) {
            const contentTop = content.scrollTop;
            const contentTopPadding = this.getComputedCssProperty(content, 'paddingTop');
            const contentBottomPadding = this.getComputedCssProperty(content, 'paddingTop');

            const item = this.itemRefs.get(term);
            if (!item) {
                return;
            }

            const itemTop = (item as HTMLElement).offsetTop - this.getComputedCssProperty(item, 'marginTop');
            const itemBottomMargin = this.getComputedCssProperty(item, 'marginBottom') + this.getComputedCssProperty(item, 'paddingBottom');
            const itemBottom = (item as HTMLElement).offsetTop + this.getComputedCssProperty(item, 'height') + itemBottomMargin;
            if (itemTop - contentTopPadding < contentTop) {
                // the item is off the top of the visible space
                content.scrollTop = itemTop - contentTopPadding;
            } else if (itemBottom + contentTopPadding + contentBottomPadding > contentTop + visibleContentHeight) {
                // the item has gone off the bottom of the visible space
                content.scrollTop = (itemBottom - visibleContentHeight) + contentTopPadding + contentBottomPadding;
            }
        }
    };

    getComputedCssProperty(element: Element | Text, property: string) {
        return parseInt(getComputedStyle(element as HTMLElement).getPropertyValue(property) || '0', 10);
    }

    getTransform() {
        if (!this.props.suggestionBoxAlgn) {
            return {};
        }

        const {lineHeight, pixelsToMoveX} = this.props.suggestionBoxAlgn;
        let pixelsToMoveY = this.props.suggestionBoxAlgn.pixelsToMoveY;

        if (this.props.position === 'bottom' && pixelsToMoveY) {
            // Add the line height and 4 extra px so it looks less tight
            pixelsToMoveY += (lineHeight || 0) + 4;
        }

        // If the suggestion box was invoked from the first line in the post box, stick to the top of the post box
        // if the lineHeight is smalller or undefined, then pixelsToMoveY should be 0
        if (lineHeight && pixelsToMoveY) {
            pixelsToMoveY = pixelsToMoveY > lineHeight ? pixelsToMoveY : 0;
        } else {
            pixelsToMoveY = 0;
        }

        return {
            transform: `translate(${pixelsToMoveX}px, ${pixelsToMoveY}px)`,
        };
    }

    renderDivider(type: string) {
        const id = type ? 'suggestion.' + type : 'suggestion.default';
        return (
            <li
                key={type + '-divider'}
                className='suggestion-list__divider'
                role='separator'
            >
                <h2>
                    <FormattedMessage id={id}/>
                </h2>
            </li>
        );
    }

    renderNoResults() {
        return (
            <ul
                key='list-no-results'
                className='suggestion-list__no-results'
                ref={this.contentRef}
            >
                <FormattedMessage
                    id='suggestionList.noMatches'
                    defaultMessage='No items match <b>{value}</b>'
                    values={{
                        value: this.props.pretext || '""',
                        b: (chunks: string) => <b>{chunks}</b>,
                    }}
                />
            </ul>
        );
    }

    render() {
        const {renderDividers} = this.props;

        if (!this.props.open || this.props.cleared) {
            return null;
        }

        const clonedItems = cloneDeep(this.props.items);

        const items = [];
        if (clonedItems.length === 0) {
            if (!this.props.renderNoResults) {
                return null;
            }
            items.push(this.renderNoResults());
        }

        let prevItemType = null;
        for (let i = 0; i < this.props.items.length; i++) {
            const item = this.props.items[i];
            const term = this.props.terms[i];
            const isSelection = term === this.props.selection;

            // ReactComponent names need to be upper case when used in JSX
            const Component = this.props.components[i];
            if ((renderDividers?.includes('all') || renderDividers?.includes(item.type)) && prevItemType !== item.type) {
                items.push(this.renderDivider(item.type));
                prevItemType = item.type;
            }

            if (item.loading) {
                items.push(<LoadingSpinner key={item.type}/>);
                continue;
            }

            items.push(
                <Component
                    key={term}
                    ref={(ref: any) => this.itemRefs.set(term, ref)}
                    id={`suggestionList_item_${term}`}
                    item={this.props.items[i]}
                    term={term}
                    matchedPretext={this.props.matchedPretext[i]}
                    isSelection={isSelection}
                    onClick={this.props.onCompleteWord}
                    onMouseMove={this.props.onItemHover}
                />,
            );
        }
        const mainClass = 'suggestion-list suggestion-list--' + this.props.position;
        const contentClass = 'suggestion-list__content suggestion-list__content--' + this.props.position;

        return (
            <div
                ref={this.wrapperRef}
                className={mainClass}
            >
                <SuggestionListList
                    id='suggestionList'
                    data-testid='suggestionList'
                    role='listbox'
                    ref={this.contentRef}
                    style={{
                        maxHeight: this.maxHeight,
                        ...this.getTransform(),
                    }}
                    className={contentClass}
                    onMouseDown={this.props.preventClose}
                >
                    {items}
                </SuggestionListList>
                <SuggestionListStatus items={this.props.items}/>
            </div>
        );
    }
}

const SuggestionListList = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>((props, ref) => {
    const {formatMessage} = useIntl();

    return (
        <ul
            ref={ref}
            aria-label={formatMessage({id: 'suggestionList.label', defaultMessage: 'Suggestions'})}
            {...props}
        />
    );
});

function SuggestionListStatus({items}: Pick<Props, 'items'>) {
    const {formatMessage} = useIntl();

    const statusText = formatMessage(
        {
            id: 'suggestionList.suggestionsAvailable',
            defaultMessage: '{count, number} {count, plural, one {suggestion} other {suggestions}} available',
        },
        {
            count: items.length,
        },
    );

    return (
        <div
            className='sr-only'
            aria-atomic={true}
            aria-live='polite'
            role='status'
        >
            {statusText}
        </div>
    );
}
