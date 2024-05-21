// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getMyChannelMembership} from 'mattermost-redux/selectors/entities/channels';

import {getChannelIntroPluginButtons} from 'selectors/plugins';

import type {GlobalState} from 'types/store';

import PluggableIntroButtons from './pluggable_intro_buttons';

type OwnProps = {
    channel: Channel;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    return {
        channelMember: getMyChannelMembership(state, ownProps.channel.id),
        pluginButtons: getChannelIntroPluginButtons(state),
    };
}

export default connect(mapStateToProps)(PluggableIntroButtons);
