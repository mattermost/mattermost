// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fetchPlaybookPropertyFieldsAction} from 'src/actions';
import {getPropertyFieldsByPlaybookId} from 'src/selectors';
import {PropertyField} from 'src/types/properties';

import {makeUseEntity} from './useEntity';

export const usePlaybookAttributes = makeUseEntity<PropertyField[], string>({
    name: 'usePlaybookAttributes',
    fetch: (playbookId: string) => {
        return fetchPlaybookPropertyFieldsAction(playbookId);
    },
    selector: (state, playbookId) => {
        return getPropertyFieldsByPlaybookId(state, playbookId);
    },
});
