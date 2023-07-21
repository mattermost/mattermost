// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Subscription} from '@mattermost/types/cloud';
import {isEmpty} from 'lodash';
import React, {ComponentType} from 'react';

interface Actions {
    getCloudSubscription?: () => void;
}

interface UsedHocProps {
    subscription?: Subscription;
    isCloud: boolean;
    actions: Actions;
    userIsAdmin?: boolean;
}

function withGetCloudSubscription<P>(WrappedComponent: ComponentType<P>): ComponentType<any> {
    return class extends React.Component<P & UsedHocProps> {
        async componentDidMount() {
            // if not is cloud, not even try to destructure values from props, just return
            if (!this.props.isCloud) {
                return;
            }
            const {subscription, actions, userIsAdmin} = this.props;

            if (isEmpty(subscription) && userIsAdmin && actions?.getCloudSubscription) {
                await actions.getCloudSubscription();
            }
        }

        render(): JSX.Element {
            return <WrappedComponent {...this.props}/>;
        }
    };
}

export default withGetCloudSubscription;
