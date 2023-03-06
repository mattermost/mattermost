// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import styled from 'styled-components';

import Tooltip from 'src/components/widgets/tooltip';

interface Props {
    show: boolean;
    id: string;
    content: ReactNode;
    disableChildrenOnShow?: boolean;
    children: JSX.Element;
}

const ConditionalTooltip = ({show, id, content, disableChildrenOnShow, children}: Props) => {
    if (show) {
        const childNodes = disableChildrenOnShow ? (
            <InlineDiv>
                <CoverButtonDiv/>
                {children}
            </InlineDiv>
        ) : children;

        return (
            <Tooltip
                id={id}
                content={content}
            >
                {childNodes}
            </Tooltip>
        );
    }

    return children;
};

const InlineDiv = styled.div`
    position: relative;
    display: inline-block;
`;

const CoverButtonDiv = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
`;

export default ConditionalTooltip;
