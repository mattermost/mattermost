// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {isCustomPostProps, type CustomPostProps} from '.';

describe('isCustomPostProps', () => {
    it('no content', () => {
        const props: CustomPostProps = {
            requested_plugins_by_plugin_ids: {},
            requested_plugins_by_user_ids: {},
        };
        expect(isCustomPostProps(props)).toBe(true);
    });

    it('content but no elements', () => {
        const props: CustomPostProps = {
            requested_plugins_by_plugin_ids: {'some id': []},
            requested_plugins_by_user_ids: {'some id': []},
        };
        expect(isCustomPostProps(props)).toBe(true);
    });

    it('content with elements', () => {
        const props: CustomPostProps = {
            requested_plugins_by_plugin_ids: {'some id': [{
                user_id: '123',
            }]},
            requested_plugins_by_user_ids: {'some id': [{
                user_id: '123',
            }]},
        };
        expect(isCustomPostProps(props)).toBe(true);
    });

    it('all values are required', () => {
        const baseProp: CustomPostProps = {
            requested_plugins_by_plugin_ids: {},
            requested_plugins_by_user_ids: {},
        };

        expect(isCustomPostProps(baseProp)).toBe(true);

        for (const key of Object.keys(baseProp)) {
            const wrongProp: Partial<CustomPostProps> = {...baseProp};
            delete wrongProp[key as keyof CustomPostProps];
            expect(isCustomPostProps(wrongProp)).toBe(false);
        }

        const wrongProp: DeepPartial<CustomPostProps> = {
            requested_plugins_by_plugin_ids: {'some id': [{}]},
            requested_plugins_by_user_ids: {'some id': []},
        };
        expect(isCustomPostProps(wrongProp)).toBe(false);
    });

    it('common false cases', () => {
        expect(isCustomPostProps('')).toBe(false);
        expect(isCustomPostProps(undefined)).toBe(false);
        expect(isCustomPostProps(true)).toBe(false);
        expect(isCustomPostProps(1)).toBe(false);
        expect(isCustomPostProps([])).toBe(false);
    });
});
