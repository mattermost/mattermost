// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react-hooks';

import type {UserPropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {generateId} from 'mattermost-redux/utils/helpers';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {
    useUserPropertyFields,
    ValidationWarningNameRequired,
    ValidationWarningNameTaken,
    ValidationWarningNameUnique,
} from './user_properties_utils';

function getBaseState(): DeepPartial<GlobalState> {
    const currentUser = TestHelper.getUserMock();
    const otherUser = TestHelper.getUserMock();

    return {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                    [otherUser.id]: otherUser,
                },
            },
            general: {

            },
        },
    };
}

describe('useUserPropertyFields', () => {
    jest.useFakeTimers();
    const getFields = jest.spyOn(Client4, 'getCustomProfileAttributeFields');
    const patchField = jest.spyOn(Client4, 'patchCustomProfileAttributeField');
    const deleteField = jest.spyOn(Client4, 'deleteCustomProfileAttributeField');
    const createField = jest.spyOn(Client4, 'createCustomProfileAttributeField');

    const baseField = {type: 'text' as const, group_id: 'custom_profile_attributes' as const, create_at: 1736541716295, delete_at: 0, update_at: 0};
    const field0: UserPropertyField = {id: 'f0', name: 'test attribute 0', ...baseField};
    const field1: UserPropertyField = {id: 'f1', name: 'test attribute 1', ...baseField};
    const field2: UserPropertyField = {id: 'f2', name: 'test attribute 2', ...baseField};
    const field3: UserPropertyField = {id: 'f3', name: 'test attribute 3', ...baseField};

    getFields.mockResolvedValue([field0, field1, field2, field3]);

    it('should return a collection', async () => {
        const {result, rerender, waitFor} = renderHookWithContext(() => {
            return useUserPropertyFields();
        }, getBaseState());

        const [fields1, read1] = result.current;
        expect(read1.loading).toBe(true);
        expect(read1.error).toBe(undefined);
        expect(getFields).toBeCalledTimes(1);
        expect(fields1.data).toEqual({});
        expect(fields1.order).toEqual([]);

        act(() => {
            jest.runAllTimers();
        });
        rerender();

        await waitFor(() => {
            const [, read] = result.current;
            expect(read.loading).toBe(false);
        });

        const [fields2, read2] = result.current;
        expect(read2.loading).toBe(false);
        expect(read2.error).toBe(undefined);
        expect(fields2.data).toEqual({[field0.id]: field0, [field1.id]: field1, [field2.id]: field2, [field3.id]: field3});
        expect(fields2.order).toEqual(['f0', 'f1', 'f2', 'f3']);
    });

    it('should successfully handle edits', async () => {
        const {result, rerender, waitFor} = renderHookWithContext(() => {
            return useUserPropertyFields();
        }, getBaseState());

        act(() => {
            jest.runAllTimers();
        });
        rerender();

        await waitFor(() => {
            const [, read] = result.current;
            expect(read.loading).toBe(false);
        });
        const [fields2,,, ops2] = result.current;

        act(() => {
            ops2.update({...fields2.data[field1.id], name: 'changed attribute value'});
        });
        rerender();

        const [fields3, readIO3, pendingIO3] = result.current;
        expect(fields3.data[field1.id].name).toBe('changed attribute value');
        expect(pendingIO3.hasChanges).toBe(true);

        patchField.mockResolvedValue({...fields3.data[field1.id]});

        await act(async () => {
            const data = await pendingIO3.commit();
            if (data) {
                readIO3.setData(data);
            }
            jest.runAllTimers();
            rerender();
        });

        await waitFor(() => {
            const [,, pending] = result.current;
            expect(pending.saving).toBe(false);
        });

        expect(patchField).toHaveBeenCalledWith(field1.id, {type: 'text', name: 'changed attribute value'});

        const [fields4,, pendingIO4] = result.current;
        expect(pendingIO4.hasChanges).toBe(false);
        expect(pendingIO4.error).toBe(undefined);
        expect(fields4.data[field1.id].name).toBe('changed attribute value');
    });

    it('should successfully handle deletes', async () => {
        const {result, rerender, waitFor} = renderHookWithContext(() => {
            return useUserPropertyFields();
        }, getBaseState());

        act(() => {
            jest.runAllTimers();
        });
        rerender();

        await waitFor(() => {
            const [, read] = result.current;
            expect(read.loading).toBe(false);
        });
        const [,,, ops2] = result.current;

        act(() => {
            ops2.delete(field1.id);
        });
        rerender();

        const [fields3, readIO3, pendingIO3] = result.current;
        expect(fields3.data[field1.id].delete_at).not.toBe(0);

        deleteField.mockResolvedValue({status: 'OK'});

        await act(async () => {
            const data = await pendingIO3.commit();
            if (data) {
                readIO3.setData(data);
            }
            jest.runAllTimers();
            rerender();
        });

        await waitFor(() => {
            const [,, pendingIO4] = result.current;
            expect(pendingIO4.saving).toBe(false);
        });

        expect(deleteField).toHaveBeenCalledWith(field1.id);

        const [fields4,,,] = result.current;
        expect(fields4.data).not.toHaveProperty(field1.id);
        expect(fields4.order).not.toEqual(expect.arrayContaining([field1.id]));
    });

    it('should successfully handle creates', async () => {
        createField.mockImplementation((patch) => Promise.resolve({...baseField, ...patch, id: generateId()} as UserPropertyField));

        const {result, rerender, waitFor} = renderHookWithContext(() => {
            return useUserPropertyFields();
        }, getBaseState());

        act(() => {
            jest.runAllTimers();
        });
        rerender();

        await waitFor(() => {
            const [, read] = result.current;
            expect(read.loading).toBe(false);
        });
        const [,,, ops2] = result.current;

        act(() => {
            ops2.create();
            ops2.create();
        });
        rerender();

        const [fields3, readIO3, pendingIO3] = result.current;
        const [createdId0, createdId1] = [...fields3.order].splice(-2, 2);
        expect(fields3.data[createdId0].create_at).toBe(0);
        expect(fields3.data[createdId1].create_at).toBe(0);

        await act(async () => {
            const data = await pendingIO3.commit();
            if (data) {
                readIO3.setData(data);
            }
            jest.runAllTimers();
            rerender();
        });

        await waitFor(() => {
            const [,, pendingIO4] = result.current;
            expect(pendingIO4.saving).toBe(false);
        });

        expect(createField).toHaveBeenCalledWith({type: 'text', name: 'Text'});
        expect(createField).toHaveBeenCalledWith({type: 'text', name: 'Text 2'});

        const [fields4,,,] = result.current;
        expect(Object.values(fields4.data)).toEqual(expect.arrayContaining([
            expect.objectContaining({name: 'Text'}),
            expect.objectContaining({name: 'Text 2'}),
        ]));

        expect(fields4.order).toEqual(expect.arrayContaining(Object.keys(fields4.data)));
    });

    it('should validate name uniqueness', async () => {
        const {result, rerender, waitFor} = renderHookWithContext(() => {
            return useUserPropertyFields();
        }, getBaseState());

        act(() => {
            jest.runAllTimers();
        });
        rerender();

        await waitFor(() => {
            const [, read] = result.current;
            expect(read.loading).toBe(false);
        });

        act(() => {
            const [fields,,, ops] = result.current;
            ops.update({...fields.data[field0.id], name: 'test attribute 1'});
        });
        rerender();

        const [fields,, pendingIO3] = result.current;
        expect(fields.data[field0.id].name).toBe('test attribute 1');
        expect(pendingIO3.hasChanges).toBe(true);
        expect(fields.warnings).toEqual(expect.objectContaining({
            [field0.id]: {name: ValidationWarningNameUnique},
            [field1.id]: {name: ValidationWarningNameUnique},
        }));
    });

    it('should validate names already taken', async () => {
        const {result, rerender, waitFor} = renderHookWithContext(() => {
            return useUserPropertyFields();
        }, getBaseState());

        act(() => {
            jest.runAllTimers();
        });
        rerender();

        await waitFor(() => {
            const [, read] = result.current;
            expect(read.loading).toBe(false);
        });

        act(() => {
            const [fields,,, ops] = result.current;

            ops.update({...fields.data[field0.id], name: 'test attribute 1'});
            ops.update({...fields.data[field1.id], name: 'Test something else'});
        });
        rerender();

        const [fields,, pendingIO] = result.current;
        expect(pendingIO.hasChanges).toBe(true);
        expect(fields.warnings).toEqual(expect.objectContaining({
            [field0.id]: {name: ValidationWarningNameTaken},
        }));

        // no warning when conflict field is to be deleted
        act(() => {
            const [,,, ops] = result.current;
            ops.delete(field1.id);
        });
        rerender();

        const [fields2] = result.current;
        expect(fields2.warnings).toBeUndefined();
    });

    it('should validate name required', async () => {
        const {result, rerender, waitFor} = renderHookWithContext(() => {
            return useUserPropertyFields();
        }, getBaseState());

        act(() => {
            jest.runAllTimers();
        });
        rerender();

        await waitFor(() => {
            const [, read] = result.current;
            expect(read.loading).toBe(false);
        });

        act(() => {
            const [fields,,, ops] = result.current;

            ops.update({...fields.data[field0.id], name: ''});
        });
        rerender();

        const [fields,, pendingIO] = result.current;
        expect(pendingIO.hasChanges).toBe(true);
        expect(fields.warnings).toEqual(expect.objectContaining({
            [field0.id]: {name: ValidationWarningNameRequired},
        }));
    });
});
