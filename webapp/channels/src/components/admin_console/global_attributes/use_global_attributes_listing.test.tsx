// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import {useSelector, useStore} from 'react-redux';

import type {GlobalAttributeListing, GlobalAttributeListingRow} from '@mattermost/types/global_attributes';
import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {getPropertyFieldById} from 'mattermost-redux/selectors/entities/properties';

import {renderHookWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import {notifyAttributeFieldChanged} from './listing_events';
import type {GlobalAttributesListingOptions} from './use_global_attributes_listing';
import useGlobalAttributesListing from './use_global_attributes_listing';

const GROUP_ID = 'accesscontrolgroupuuid001';

function makeRow(id: string, groupId = GROUP_ID): GlobalAttributeListingRow {
    return {
        field: {
            id,
            name: id,
            type: 'text',
            group_id: groupId,
            object_type: 'template',
            target_id: '',
            target_type: 'system',
            create_at: 1,
            update_at: 0,
            delete_at: 0,
            created_by: '',
            updated_by: '',
            attrs: {},
        } as PropertyField,
        applies_to: [],
        owners: [],
        source_kind: 'managed',
        sync_sources: [],
        is_classification: false,
    };
}

function listing(ids: string[]): GlobalAttributeListing {
    return {rows: ids.map((id) => makeRow(id))};
}

function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (reason: unknown) => void = () => {};
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
}

describe('useGlobalAttributesListing', () => {
    const searchGlobalAttributes = jest.spyOn(Client4, 'searchGlobalAttributes');

    beforeEach(() => {
        jest.useFakeTimers();
        searchGlobalAttributes.mockReset();
        searchGlobalAttributes.mockResolvedValue(listing([]));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const advance = (ms: number) => act(async () => {
        await jest.advanceTimersByTimeAsync(ms);
    });

    const lastRequest = () => searchGlobalAttributes.mock.calls[searchGlobalAttributes.mock.calls.length - 1][0];

    // Options live in a variable the hook callback closes over, so a test changes
    // them the way the page does: by re-rendering with new ones.
    function setup(initial: GlobalAttributesListingOptions = {}) {
        let options = initial;
        const utils = renderHookWithContext(() => ({
            listing: useGlobalAttributesListing(options),
            cachedField: useSelector((state: GlobalState) => getPropertyFieldById(state, 'a')),
            store: useStore<GlobalState>(),
        }));
        return {
            ...utils,
            update: (next: GlobalAttributesListingOptions) => {
                options = {...options, ...next};
                utils.rerender();
            },
        };
    }

    it('fetches as soon as it mounts, without waiting for the debounce', async () => {
        searchGlobalAttributes.mockResolvedValue(listing(['a', 'b']));

        const {result} = setup({term: 'clear'});
        await advance(0);

        expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
        expect(lastRequest()).toEqual({term: 'clear'});
        expect(result.current.listing.rows.map((row) => row.field.id)).toEqual(['a', 'b']);
        expect(result.current.listing.loaded).toBe(true);
        expect(result.current.listing.loading).toBe(false);
        expect(result.current.listing.error).toBe(false);
    });

    it('omits a blank term from the request and trims a padded one', async () => {
        const {update} = setup({term: '   '});
        await advance(0);
        expect(lastRequest().term).toBeUndefined();

        update({term: '  clear  '});
        await advance(300);
        expect(lastRequest().term).toBe('clear');
    });

    it('stores the fetched fields so the cached-field consumers see them', async () => {
        searchGlobalAttributes.mockResolvedValue(listing(['a']));

        const {result} = setup();
        await advance(0);

        expect(result.current.cachedField?.id).toBe('a');
    });

    describe('source', () => {
        it('sends the source with the term', async () => {
            setup({term: 'clear', source: 'ldap'});
            await advance(0);

            expect(lastRequest()).toStrictEqual({term: 'clear', source: 'ldap'});
        });

        it('sends no source for All', async () => {
            setup();
            await advance(0);

            expect(lastRequest().source).toBeUndefined();
        });

        it('requests a new source right away, without waiting for the debounce', async () => {
            const {update} = setup({term: 'clear'});
            await advance(0);
            searchGlobalAttributes.mockClear();

            update({source: 'plugin'});
            await advance(0);

            expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
            expect(lastRequest()).toStrictEqual({term: 'clear', source: 'plugin'});

            update({source: undefined});
            await advance(0);

            expect(searchGlobalAttributes).toHaveBeenCalledTimes(2);
            expect(lastRequest().source).toBeUndefined();
        });

        it('ignores a slower response for the previous source', async () => {
            const ldap = deferred<GlobalAttributeListing>();
            const saml = deferred<GlobalAttributeListing>();
            searchGlobalAttributes.
                mockReturnValueOnce(ldap.promise).
                mockReturnValueOnce(saml.promise);

            const {result, update} = setup({source: 'ldap'});
            await advance(0);
            update({source: 'saml'});
            await advance(0);

            await act(async () => {
                saml.resolve(listing(['saml_row']));
                ldap.resolve(listing(['ldap_row']));
            });

            expect(result.current.listing.rows.map((row) => row.field.id)).toEqual(['saml_row']);
        });

        it('refetches with the current source', async () => {
            const {result} = setup({source: 'openid'});
            await advance(0);
            searchGlobalAttributes.mockClear();

            await act(async () => {
                await result.current.listing.refetch();
            });

            expect(lastRequest()).toStrictEqual({term: undefined, source: 'openid'});
        });
    });

    describe('debounce', () => {
        it('waits 300ms after the last term change before requesting', async () => {
            const {update} = setup();
            await advance(0);
            searchGlobalAttributes.mockClear();

            update({term: 'c'});
            await advance(200);
            update({term: 'cl'});
            await advance(200);
            update({term: 'cle'});
            await advance(299);

            expect(searchGlobalAttributes).not.toHaveBeenCalled();

            await advance(1);

            expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
            expect(lastRequest().term).toBe('cle');
        });

        it('does not request again when the term changes back before the debounce elapses', async () => {
            const {update} = setup({term: 'a'});
            await advance(0);
            searchGlobalAttributes.mockClear();

            update({term: 'ab'});
            await advance(100);
            update({term: 'a'});
            await advance(500);

            expect(searchGlobalAttributes).not.toHaveBeenCalled();
        });
    });

    describe('stale responses', () => {
        it('ignores a slower response to an earlier request', async () => {
            const first = deferred<GlobalAttributeListing>();
            const second = deferred<GlobalAttributeListing>();
            searchGlobalAttributes.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

            const {result, update} = setup();
            await advance(0);
            update({term: 'new'});
            await advance(300);
            expect(searchGlobalAttributes).toHaveBeenCalledTimes(2);

            await act(async () => {
                second.resolve(listing(['new-result']));
            });
            await act(async () => {
                first.resolve(listing(['old-result']));
            });

            expect(result.current.listing.rows.map((row) => row.field.id)).toEqual(['new-result']);
            expect(result.current.listing.loading).toBe(false);
        });

        it('ignores an earlier request that fails after a later one succeeded', async () => {
            const first = deferred<GlobalAttributeListing>();
            searchGlobalAttributes.mockReturnValueOnce(first.promise).mockResolvedValueOnce(listing(['ok']));

            const {result, update} = setup();
            await advance(0);
            update({term: 'new'});
            await advance(300);

            await act(async () => {
                first.reject(new Error('late'));
            });

            expect(result.current.listing.error).toBe(false);
            expect(result.current.listing.rows.map((row) => row.field.id)).toEqual(['ok']);
        });

        it('does not update state from a response that lands after unmount', async () => {
            const pending = deferred<GlobalAttributeListing>();
            searchGlobalAttributes.mockReturnValueOnce(pending.promise);

            const {result, unmount} = setup();
            await advance(0);
            unmount();

            await act(async () => {
                pending.resolve(listing(['a']));
            });

            // Read from the store itself, since an unmounted hook no longer renders.
            expect(getPropertyFieldById(result.current.store.getState(), 'a')).toBeUndefined();
        });

        it('keeps the previous rows visible while the next request is in flight', async () => {
            searchGlobalAttributes.mockResolvedValueOnce(listing(['a']));

            const {result, update} = setup();
            await advance(0);

            searchGlobalAttributes.mockReturnValueOnce(new Promise(() => {}));
            update({term: 'next'});
            await advance(300);

            expect(result.current.listing.loading).toBe(true);
            expect(result.current.listing.rows.map((row) => row.field.id)).toEqual(['a']);
        });
    });

    describe('errors', () => {
        // The failure is logged, which the suite would otherwise flag as unexpected.
        let consoleSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('reports the error and no rows when the first request fails', async () => {
            searchGlobalAttributes.mockRejectedValue(new Error('boom'));

            const {result} = setup();
            await advance(0);

            expect(result.current.listing.error).toBe(true);
            expect(result.current.listing.loaded).toBe(false);
            expect(result.current.listing.loading).toBe(false);
            expect(result.current.listing.rows).toEqual([]);
        });

        it('clears the error once a later request succeeds', async () => {
            searchGlobalAttributes.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(listing(['a']));

            const {result} = setup();
            await advance(0);
            expect(result.current.listing.error).toBe(true);

            await act(async () => {
                await result.current.listing.refetch();
            });

            expect(result.current.listing.error).toBe(false);
            expect(result.current.listing.rows.map((row) => row.field.id)).toEqual(['a']);
        });
    });

    describe('refetch', () => {
        it('requests the current term again and replaces the rows', async () => {
            searchGlobalAttributes.mockResolvedValue(listing(['a', 'b']));

            const {result} = setup({term: 'clear'});
            await advance(0);
            searchGlobalAttributes.mockClear();
            searchGlobalAttributes.mockResolvedValueOnce(listing(['a']));

            await act(async () => {
                await result.current.listing.refetch();
            });

            expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
            expect(lastRequest()).toEqual({term: 'clear'});
            expect(result.current.listing.rows.map((row) => row.field.id)).toEqual(['a']);
        });

        it('shows an emptied listing as loaded with no rows', async () => {
            searchGlobalAttributes.mockResolvedValueOnce(listing(['a']));

            const {result} = setup();
            await advance(0);

            searchGlobalAttributes.mockResolvedValueOnce(listing([]));
            await act(async () => {
                await result.current.listing.refetch();
            });

            expect(searchGlobalAttributes).toHaveBeenCalledTimes(2);
            expect(result.current.listing.rows).toEqual([]);
            expect(result.current.listing.loaded).toBe(true);
        });
    });

    describe('websocket refetch', () => {
        it('refetches once, after the debounce, when a property field changes', async () => {
            searchGlobalAttributes.mockResolvedValue(listing(['a']));
            setup();
            await advance(0);
            searchGlobalAttributes.mockClear();

            act(() => notifyAttributeFieldChanged(GROUP_ID));
            expect(searchGlobalAttributes).not.toHaveBeenCalled();
            await advance(299);
            expect(searchGlobalAttributes).not.toHaveBeenCalled();

            await advance(1);
            expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
        });

        it('coalesces a burst of events into one refetch of the current term', async () => {
            searchGlobalAttributes.mockResolvedValue(listing(['a']));
            setup({term: 'clear'});
            await advance(0);
            searchGlobalAttributes.mockClear();

            act(() => {
                notifyAttributeFieldChanged(GROUP_ID);
                notifyAttributeFieldChanged(GROUP_ID);
            });
            await advance(150);
            act(() => notifyAttributeFieldChanged(GROUP_ID));
            await advance(300);

            expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
            expect(lastRequest()).toEqual({term: 'clear'});
        });

        it('refetches for a change whose group is unknown, such as a delete of an uncached field', async () => {
            searchGlobalAttributes.mockResolvedValue(listing(['a']));
            setup();
            await advance(0);
            searchGlobalAttributes.mockClear();

            act(() => notifyAttributeFieldChanged(undefined));
            await advance(300);

            expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
        });

        it('ignores a change in another property group once the rows name theirs', async () => {
            searchGlobalAttributes.mockResolvedValue(listing(['a']));
            setup();
            await advance(0);
            searchGlobalAttributes.mockClear();

            act(() => notifyAttributeFieldChanged('some-plugin-group'));
            await advance(1000);

            expect(searchGlobalAttributes).not.toHaveBeenCalled();
        });

        it('refetches for any group while the listing is empty and cannot name its own', async () => {
            const {result} = setup();
            await advance(0);
            expect(result.current.listing.rows).toEqual([]);
            searchGlobalAttributes.mockClear();

            act(() => notifyAttributeFieldChanged('some-group'));
            await advance(300);

            expect(searchGlobalAttributes).toHaveBeenCalledTimes(1);
        });

        it('stops listening, and cancels a pending refetch, on unmount', async () => {
            searchGlobalAttributes.mockResolvedValue(listing(['a']));
            const {unmount} = setup();
            await advance(0);
            searchGlobalAttributes.mockClear();

            act(() => notifyAttributeFieldChanged(GROUP_ID));
            await advance(100);
            unmount();
            await advance(1000);
            act(() => notifyAttributeFieldChanged(GROUP_ID));
            await advance(1000);

            expect(searchGlobalAttributes).not.toHaveBeenCalled();
        });
    });
});
