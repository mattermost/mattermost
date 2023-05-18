// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';

export interface SuggestionProps<Item> {
    // eslint-disable-next-line react/no-unused-prop-types
    item: Item;

    term: string;
    matchedPretext: string;
    isSelection: boolean;

    children?: React.ReactNode;
    onClick: (term: string, matchedPretext: string) => void;
    onMouseMove: (term: string) => void;

    'data-testid'?: string;
    id?: string;
    role?: string;
    tabIndex?: number;
}

const SuggestionContainer = React.forwardRef<HTMLDivElement, SuggestionProps<unknown>>((props, ref) => {
    const {
        onClick,
        onMouseMove,
    } = props;

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        onClick(props.term, props.matchedPretext);
    }, [onClick, props.term, props.matchedPretext]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        onMouseMove(props.term);
    }, [onMouseMove, props.term]);

    return (
        <div
            id={props.id}
            ref={ref}
            className={classNames('suggestion-list__item', {'suggestion--selected': props.isSelection})}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            role={props.role ?? 'button'}
            tabIndex={props.tabIndex ?? -1}
            data-testid={props['data-testid']}
        >
            {props.children}
        </div>
    );
});

SuggestionContainer.displayName = 'SuggestionContainer';
export {SuggestionContainer};
