// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ReactNode} from 'react';

import {bindActionCreators, Dispatch} from 'redux';
import {connect, ConnectedProps} from 'react-redux';

import { Post } from '@mattermost/types/src/posts';

import {GenericAction} from 'mattermost-redux/types/actions';

import {toggleInlineImageVisibility} from 'actions/post_actions';
import {isInlineImageVisible} from 'selectors/posts';
import {GlobalState} from 'types/store';

import MarkdownImageExpand from './markdown_image_expand';

export type OwnProps = {
    postId: Post['id'];
    imageKey: string;
    alt: string;
    onToggle?: (isExpanded: boolean) => void;
    children: ReactNode;
}

const mapStateToProps = (state: GlobalState, {postId, imageKey}: OwnProps) => {
    return {
        isExpanded: isInlineImageVisible(state, postId, imageKey),
    };
};

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => {
    return {
        actions: bindActionCreators({toggleInlineImageVisibility}, dispatch),
    };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(MarkdownImageExpand);
