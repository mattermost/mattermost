// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {AppBinding} from '@mattermost/types/apps';
import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {AppBindingLocations, AppCallResponseTypes} from 'mattermost-redux/constants/apps';
import type {ActionResult} from 'mattermost-redux/types/actions';

import Markdown from 'components/markdown';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {createCallContext} from 'utils/apps';

import type {PostEphemeralCallResponseForPost, HandleBindingClick, OpenAppsModal} from 'types/apps';

type Props = {
    intl: IntlShape;
    binding: AppBinding;
    post: Post;
    actions: {
        handleBindingClick: HandleBindingClick;
        getChannel: (channelId: string) => Promise<ActionResult>;
        postEphemeralCallResponseForPost: PostEphemeralCallResponseForPost;
        openAppsModal: OpenAppsModal;
    };
}

type State = {
    executing: boolean;
}

class ButtonBinding extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            executing: false,
        };
    }

    handleClick = async () => {
        const {binding, post, intl} = this.props;

        let teamID = '';
        const {data} = await this.props.actions.getChannel(post.channel_id) as {data?: any; error?: any};
        if (data) {
            const channel = data as Channel;
            teamID = channel.team_id;
        }

        const context = createCallContext(
            binding.app_id,
            AppBindingLocations.IN_POST + '/' + binding.location,
            post.channel_id,
            teamID,
            post.id,
            post.root_id,
        );

        this.setState({executing: true});
        const res = await this.props.actions.handleBindingClick(binding, context, intl);
        this.setState({executing: false});

        if (res.error) {
            const errorResponse = res.error;
            const errorMessage = errorResponse.text || intl.formatMessage({
                id: 'apps.error.unknown',
                defaultMessage: 'Unknown error occurred.',
            });
            this.props.actions.postEphemeralCallResponseForPost(errorResponse, errorMessage, post);
            return;
        }

        const callResp = res.data!;
        switch (callResp.type) {
        case AppCallResponseTypes.OK:
            if (callResp.text) {
                this.props.actions.postEphemeralCallResponseForPost(callResp, callResp.text, post);
            }
            break;
        case AppCallResponseTypes.NAVIGATE:
            // already handled
            break;
        case AppCallResponseTypes.FORM:
            if (callResp.form) {
                this.props.actions.openAppsModal(callResp.form, context);
            }
            break;
        default: {
            const errorMessage = intl.formatMessage({
                id: 'apps.error.responses.unknown_type',
                defaultMessage: 'App response type not supported. Response type: {type}.',
            }, {
                type: callResp.type,
            });
            this.props.actions.postEphemeralCallResponseForPost(callResp, errorMessage, post);
        }
        }
    };

    render() {
        const {binding} = this.props;

        if (!binding.submit && !binding.form?.submit && !binding.form?.source) {
            return null;
        }

        const label = binding.label || binding.location;
        if (!label) {
            return null;
        }

        return (
            <button
                className='btn btn-sm'
                onClick={this.handleClick}
            >
                <LoadingWrapper
                    loading={this.state.executing}
                >
                    <Markdown
                        message={label}
                        options={{
                            mentionHighlight: false,
                            markdown: false,
                            autolinkedUrlSchemes: [],
                        }}
                    />
                </LoadingWrapper>
            </button>
        );
    }
}

export default injectIntl(ButtonBinding);
