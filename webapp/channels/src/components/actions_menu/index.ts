// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {AppBinding} from '@mattermost/types/apps';
import type {Post} from '@mattermost/types/posts';

import {Permissions} from 'mattermost-redux/constants';
import {AppBindingLocations} from 'mattermost-redux/constants/apps';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {isMarketplaceEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import type {GenericAction} from 'mattermost-redux/types/actions';
import {isCombinedUserActivityPost} from 'mattermost-redux/utils/post_list';
import {isSystemMessage} from 'mattermost-redux/utils/post_utils';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {makeFetchBindings, postEphemeralCallResponseForPost, handleBindingClick, openAppsModal} from 'actions/apps';
import {openModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';

import type {ModalData} from 'types/actions';
import type {HandleBindingClick, OpenAppsModal, PostEphemeralCallResponseForPost} from 'types/apps';
import type {GlobalState} from 'types/store';

import ActionsMenu from './actions_menu';
import {makeGetPostOptionBinding} from './selectors';

type Props = {
    post: Post;
    handleCardClick?: (post: Post) => void;
    handleDropdownOpened: (open: boolean) => void;
    isMenuOpen: boolean;
    location?: ComponentProps<typeof ActionsMenu>['location'];
};

const emptyBindings: AppBinding[] = [];

const getPostOptionBinding = makeGetPostOptionBinding();

const fetchBindings = makeFetchBindings(AppBindingLocations.POST_MENU_ITEM);

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const {post} = ownProps;

    const systemMessage = isSystemMessage(post);

    const apps = appsEnabled(state);
    const showBindings = apps && !systemMessage && !isCombinedUserActivityPost(post.id);
    let appBindings: AppBinding[] | null = emptyBindings;
    if (showBindings) {
        appBindings = getPostOptionBinding(state, ownProps.location);
    }
    const currentUser = getCurrentUser(state);
    const isSysAdmin = isSystemAdmin(currentUser.roles);

    return {
        appBindings,
        appsEnabled: apps,
        components: state.plugins.components,
        isSysAdmin,
        pluginMenuItems: state.plugins.components.PostDropdownMenu,
        teamId: getCurrentTeamId(state),
        isMobileView: getIsMobileView(state),
        canOpenMarketplace: (
            isMarketplaceEnabled(state) &&
            haveICurrentTeamPermission(state, Permissions.SYSCONSOLE_WRITE_PLUGINS)
        ),
    };
}

type Actions = {
    handleBindingClick: HandleBindingClick;
    fetchBindings: (channelId: string, teamId: string) => Promise<{data: AppBinding[]}>;
    openModal: <P>(modalData: ModalData<P>) => void;
    openAppsModal: OpenAppsModal;
    postEphemeralCallResponseForPost: PostEphemeralCallResponseForPost;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Actions>({
            handleBindingClick,
            fetchBindings,
            openModal,
            openAppsModal,
            postEphemeralCallResponseForPost,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ActionsMenu);
