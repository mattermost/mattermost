// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

export type PropertyValueEditorProps = {
    field: PropertyField;
    value: unknown;
    onChange: (value: unknown) => void;
};
