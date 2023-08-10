// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {getCloudSubscription} from 'mattermost-redux/actions/cloud';
import {checkHadPriorTrial, getCloudCustomer} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {deprecateCloudFree} from 'mattermost-redux/selectors/entities/preferences';

import {openModal} from 'actions/views/modals';

import withGetCloudSubscription from 'components/common/hocs/cloud/with_get_cloud_subscription';

import {LicenseSkus} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';

import FeatureDiscovery from './feature_discovery';

import type {Action, GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const subscription = state.entities.cloud.subscription;
    const license = getLicense(state);
    const isCloud = isCloudLicense(license);
    const hasPriorTrial = checkHadPriorTrial(state);
    const isCloudTrial = subscription?.is_free_trial === 'true';
    const customer = getCloudCustomer(state);
    const cloudFreeDeprecated = deprecateCloudFree(state);
    return {
        stats: state.entities.admin.analytics,
        prevTrialLicense: state.entities.admin.prevTrialLicense,
        isCloud,
        isCloudTrial,
        isSubscriptionLoaded: subscription !== undefined && subscription !== null,
        hadPrevCloudTrial: hasPriorTrial,
        isPaidSubscription: isCloud && license?.SkuShortName !== LicenseSkus.Starter && !isCloudTrial,
        customer,
        cloudFreeDeprecated,
    };
}

type Actions = {
    getPrevTrialLicense: () => void;
    getCloudSubscription: () => void;
    openModal: <P>(modalData: ModalData<P>) => void;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            getPrevTrialLicense,
            getCloudSubscription,
            openModal,
        }, dispatch),
    };
}

export default withGetCloudSubscription(connect(mapStateToProps, mapDispatchToProps)(FeatureDiscovery));
