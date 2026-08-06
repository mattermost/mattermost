// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppCall, AppField, AppForm, AppSelectOption} from '@mattermost/types/apps';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {cleanForm} from './apps';

describe('Apps Utils', () => {
    const basicCall: AppCall = {
        path: 'url',
    };

    describe('cleanForm', () => {
        test('no field filter on names', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.TEXT,
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.TEXT,
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('no field filter on labels', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'opt1',
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.TEXT,
                        label: 'opt2',
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'opt1',
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.TEXT,
                        label: 'opt2',
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('no field filter with no name', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        type: AppFieldTypes.TEXT,
                        label: 'opt1',
                    } as AppField,
                    {
                        name: 'opt2',
                        type: AppFieldTypes.TEXT,
                        label: 'opt2',
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt2',
                        type: AppFieldTypes.TEXT,
                        label: 'opt2',
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter with same label inferred from name', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'same',
                        type: AppFieldTypes.TEXT,
                    },
                    {
                        name: 'same',
                        type: AppFieldTypes.BOOL,
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'same',
                        type: AppFieldTypes.TEXT,
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter with same labels', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'same',
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.TEXT,
                        label: 'same',
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'same',
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter with multiword name', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'opt1',
                    },
                    {
                        name: 'opt 2',
                        type: AppFieldTypes.TEXT,
                        label: 'opt2',
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'opt1',
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter with multiword label', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'opt1',
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.TEXT,
                        label: 'opt 2',
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'opt1',
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter more than one field', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'same',
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.BOOL,
                        label: 'same',
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.USER,
                        label: 'same',
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.TEXT,
                        label: 'same',
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter static with no options', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter static options with no value', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {value: 'opt1'} as AppSelectOption,
                            {} as AppSelectOption,
                        ],
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {value: 'opt1'} as AppSelectOption,
                        ],
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter static options with same label inferred from value', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {
                                value: 'same',
                                icon_data: 'opt1',
                            } as AppSelectOption,
                            {
                                value: 'same',
                                icon_data: 'opt2',
                            } as AppSelectOption,
                        ],
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {
                                value: 'same',
                                icon_data: 'opt1',
                            } as AppSelectOption,
                        ],
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter static options with same label', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {
                                value: 'opt1',
                                label: 'same',
                            },
                            {
                                value: 'opt2',
                                label: 'same',
                            },
                        ],
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {
                                value: 'opt1',
                                label: 'same',
                            },
                        ],
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter static options with same value', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {
                                label: 'opt1',
                                value: 'same',
                            },
                            {
                                label: 'opt2',
                                value: 'same',
                            },
                        ],
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {
                                label: 'opt1',
                                value: 'same',
                            },
                        ],
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('invalid static options don\'t consume namespace', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {
                                label: 'same1',
                                value: 'same1',
                            },
                            {
                                label: 'same1',
                                value: 'same2',
                            },
                            {
                                label: 'same2',
                                value: 'same1',
                            },
                            {
                                label: 'same2',
                                value: 'same2',
                            },
                        ],
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {
                                label: 'same1',
                                value: 'same1',
                            },
                            {
                                label: 'same2',
                                value: 'same2',
                            },
                        ],
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter static with no valid options', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {} as AppSelectOption,
                        ],
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('invalid static field does not consume namespace', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'field1',
                        type: AppFieldTypes.STATIC_SELECT,
                        options: [
                            {} as AppSelectOption,
                        ],
                    },
                    {
                        name: 'field1',
                        type: AppFieldTypes.TEXT,
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'field1',
                        type: AppFieldTypes.TEXT,
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('field filter dynamic with no valid lookup call', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.DYNAMIC_SELECT,
                        lookup: basicCall,
                    },
                    {
                        name: 'opt2',
                        type: AppFieldTypes.DYNAMIC_SELECT,
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'opt1',
                        type: AppFieldTypes.DYNAMIC_SELECT,
                        lookup: basicCall,
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
        test('invalid dynamic field does not consume namespace', () => {
            const inForm: AppForm = {
                fields: [
                    {
                        name: 'field1',
                        type: AppFieldTypes.DYNAMIC_SELECT,
                    },
                    {
                        name: 'field1',
                        type: AppFieldTypes.TEXT,
                    },
                ],
            };
            const outForm: AppForm = {
                fields: [
                    {
                        name: 'field1',
                        type: AppFieldTypes.TEXT,
                    },
                ],
            };

            cleanForm(inForm);
            expect(inForm).toEqual(outForm);
        });
    });
});
