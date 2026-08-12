// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import isPropValid from '@emotion/is-prop-valid';
import React from 'react';
import {StyleSheetManager, type WebTarget} from 'styled-components';

export interface StyledProviderProps {
    children: React.ReactNode;
}

export default function StyledProvider({children}: StyledProviderProps) {
    return (
        <StyleSheetManager shouldForwardProp={filterHtmlAttributes}>
            {children}
        </StyleSheetManager>
    );
}

/**
 * Prevents styled-components from forwarding props to HTML elements that aren't HTML attributes.
 *
 * See https://styled-components.com/docs/faqs#shouldforwardprop-is-no-longer-provided-by-default for more information.
 */
function filterHtmlAttributes(propName: string, target: WebTarget) {
    if (typeof target === 'string') {
        // For HTML elements, forward the prop if it is a valid HTML attribute
        return isPropValid(propName);
    }

    // For other elements, forward all props
    return true;
}
