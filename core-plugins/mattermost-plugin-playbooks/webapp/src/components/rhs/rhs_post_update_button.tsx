// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled, {css} from 'styled-components';

import {DestructiveButton, PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';

interface Props {
    collapsed: boolean;
    isDue: boolean;
    isNextUpdateScheduled: boolean;
    updatesExist: boolean;
    disabled: boolean;
    onClick: () => void;
}

const RHSPostUpdateButton = (props: Props) => {
    let ButtonComponent = PostUpdatePrimaryButton;

    if (props.isDue) {
        ButtonComponent = PostUpdateDestructiveButton;
    } else if (!props.isNextUpdateScheduled && props.updatesExist) {
        ButtonComponent = PostUpdateTertiaryButton;
    }

    return (
        <ButtonComponent
            collapsed={props.collapsed}
            disabled={props.disabled}
            onClick={props.onClick}
        >
            <FormattedMessage defaultMessage='Post update'/>
        </ButtonComponent>
    );
};

interface CollapsedProps {
    collapsed: boolean;
}

const PostUpdateButtonCommon = css<CollapsedProps>`
    justify-content: center;
    flex: 1;
    ${({collapsed}) => collapsed && css`
        height: 32px;
        padding: 0 16px;
        font-size: 12px;
    `};
`;

const PostUpdatePrimaryButton = styled(PrimaryButton)<CollapsedProps>`
    ${PostUpdateButtonCommon};
`;

const PostUpdateTertiaryButton = styled(TertiaryButton)<CollapsedProps>`
    ${PostUpdateButtonCommon};
`;

const PostUpdateDestructiveButton = styled(DestructiveButton)<CollapsedProps>`
    ${PostUpdateButtonCommon};
`;

export default RHSPostUpdateButton;
