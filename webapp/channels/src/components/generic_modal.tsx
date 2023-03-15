// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericModal} from '@mattermost/components';

import {t} from 'utils/i18n';

import './generic_modal.scss';

// TODO MM-51399 These strings are properly defined in @mattermost/components, but the i18n tooling currently can't
// find them there, so we've had to redefine them here
t('generic_modal.cancel');
t('generic_modal.confirm');

export default GenericModal;
