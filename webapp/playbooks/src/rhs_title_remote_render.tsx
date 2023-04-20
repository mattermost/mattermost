// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';

const placeholderID = 'playbooks-rhs-title-placeholder';

const PlaceholderContainer = styled.div`
    width: 100%;
    height: 100%;
`;

export const RHSTitlePlaceholder = () => {
    return (
        <PlaceholderContainer
            id={placeholderID}
        />
    );
};

export const RHSTitleRemoteRender = (props: {children: React.ReactNode}) => {
    const container = document.getElementById(placeholderID);
    if (!container) {
        return null;
    }

    return ReactDOM.createPortal(props.children, container);
};
