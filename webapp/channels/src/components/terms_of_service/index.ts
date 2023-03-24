// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {getTermsOfService, updateMyTermsOfServiceStatus} from 'mattermost-redux/actions/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getUseCaseOnboarding} from 'mattermost-redux/selectors/entities/preferences';

import {GlobalState} from '@mattermost/types/store';
import {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import {TermsOfService as ReduxTermsOfService} from '@mattermost/types/terms_of_service';

import {getEmojiMap} from 'selectors/emojis';

import TermsOfService, {UpdateMyTermsOfServiceStatusResponse} from './terms_of_service';

type Actions = {
    getTermsOfService: () => Promise<{data: ReduxTermsOfService}>;
    updateMyTermsOfServiceStatus: (
        termsOfServiceId: string,
        accepted: boolean
    ) => {data: UpdateMyTermsOfServiceStatusResponse};
};

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const useCaseOnboarding = getUseCaseOnboarding(state);
    return {
        useCaseOnboarding,
        termsEnabled: config.EnableCustomTermsOfService === 'true',
        emojiMap: getEmojiMap(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getTermsOfService,
            updateMyTermsOfServiceStatus,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TermsOfService);
