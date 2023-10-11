// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';

export interface SuggestionProps<Item> extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick' | 'onMouseMove'> {
    // eslint-disable-next-line react/no-unused-prop-types
    item: Item;

    term: string;
    matchedPretext: string;
    isSelection: boolean;

    children?: React.ReactNode;
    onClick: (term: string, matchedPretext: string) => void;
    onMouseMove: (term: string) => void;
}

const SuggestionContainer = React.forwardRef<HTMLDivElement, SuggestionProps<unknown>>((props, ref) => {
    const {
        children,
        term,
        matchedPretext,
        isSelection,

        onClick,
        onMouseMove,

        role = 'button',
        tabIndex = -1,
        ...otherProps
    } = props;

    Reflect.deleteProperty(otherProps, 'item');

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        onClick(term, matchedPretext);
    }, [onClick, term, matchedPretext]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        onMouseMove(term);
    }, [onMouseMove, term]);

    return (
        <div
            ref={ref}
            className={classNames('suggestion-list__item', {'suggestion--selected': isSelection})}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            role={role}
            tabIndex={tabIndex}
            {...otherProps}
        >
            {children}
        </div>
    );
});

SuggestionContainer.displayName = 'SuggestionContainer';
export {SuggestionContainer};
