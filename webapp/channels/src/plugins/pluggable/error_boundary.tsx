// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

type Props = {
    children: React.ReactNode;
    pluginId?: string;
}

type State = {
    hasError: boolean;
}

const WrapperDiv = styled.div`
    align-items: center;
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: center;
    width: 100%;

    #root > & {
        // prevent root layout error; fit into announcement area
        grid-area: announcement;
        display: flex;
        word-break: normal;
        flex-direction: row;
        gap: 10px;
        height: 40px;
    }
`;

export default class PluggableErrorBoundary extends React.PureComponent<Props, State> {
    state = {
        hasError: false,
    };

    static getDerivedStateFromError() {
        return {
            hasError: true,
        };
    }

    clearErrorState = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        this.setState({hasError: false});
    };

    render() {
        if (this.state.hasError) {
            return (
                <WrapperDiv>
                    <FormattedMessage
                        id='pluggable.errorOccurred'
                        defaultMessage='An error occurred in the {pluginId} plugin.'
                        values={{
                            pluginId: this.props.pluginId,
                        }}
                    />
                    <br/>
                    <a
                        href='#'
                        onClick={this.clearErrorState}
                    >
                        <FormattedMessage
                            id='pluggable.errorRefresh'
                            defaultMessage='Refresh?'
                            values={{
                                pluginId: this.props.pluginId,
                            }}
                        />
                    </a>
                </WrapperDiv>
            );
        }

        return this.props.children;
    }
}
