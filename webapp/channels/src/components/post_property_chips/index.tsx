// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {loadPostPropertyValues} from 'mattermost-redux/actions/properties';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getPostPropertyFieldsForChannel} from 'mattermost-redux/selectors/entities/properties';

import type {GlobalState} from 'types/store';

import PostPropertyChips from './post_property_chips';

type OwnProps = {
    postId: string;

    // channelId is consumed by mapStateToProps to scope property fields to the post's channel.
    // eslint-disable-next-line react/no-unused-prop-types
    channelId: string;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        fields: getPostPropertyFieldsForChannel(state, ownProps.channelId),
        valuesByFieldId: state.entities.properties.values.byTargetId[ownProps.postId] ?? {},
        integratedBoardsEnabled: getFeatureFlagValue(state, 'IntegratedBoards') === 'true',
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({loadPostPropertyValues}, dispatch),
    };
}

type ConnectedProps = ReturnType<typeof mapStateToProps> & {
    actions: ReturnType<typeof mapDispatchToProps>['actions'];
} & OwnProps;

function PostPropertyChipsConnected(props: ConnectedProps) {
    if (!props.integratedBoardsEnabled) {
        return null;
    }
    return (
        <PostPropertyChips
            postId={props.postId}
            fields={props.fields}
            valuesByFieldId={props.valuesByFieldId}
            loadPostPropertyValues={props.actions.loadPostPropertyValues}
        />
    );
}

export default connect(mapStateToProps, mapDispatchToProps)(PostPropertyChipsConnected);
