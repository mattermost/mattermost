// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import Constants from 'utils/constants';

import SuggestionList from './suggestion_list';

type Props = React.ComponentProps<typeof SuggestionList> & {
    inputRef: React.RefObject<HTMLTextAreaElement>;
    open: boolean;
}

export default function RhsSuggestionList(props: Props): JSX.Element {
    const [position, setPosition] = useState<Props['position']>('top');
    const isMobile = useSelector(getIsMobileView);

    useEffect(() => {
        const input = props.inputRef.current;
        if (input && props.open) {
            const inputTop = input.getBoundingClientRect().top ?? 0;
            const requiredSpace = isMobile ? Constants.MOBILE_SUGGESTION_LIST_SPACE_RHS : Constants.SUGGESTION_LIST_SPACE_RHS;
            const newPosition = (inputTop < requiredSpace) ? 'bottom' : 'top';

            if (newPosition !== position) {
                // This potentially causes a second render when the list position changes, but that's better
                // than checking the bounding rectangle while rendering.
                setPosition(newPosition);
            }
        }
    }, [position, props.inputRef, props.open, isMobile]);

    return (
        <SuggestionList
            {...props}
            position={position}
        />
    );
}
