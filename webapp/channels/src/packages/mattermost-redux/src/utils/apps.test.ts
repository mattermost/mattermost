// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AppBindingLocations, AppFieldTypes} from 'mattermost-redux/constants/apps';

import {cleanForm, cleanBinding, validateBindings} from './apps';

import type {AppBinding, AppCall, AppField, AppForm, AppSelectOption} from '@mattermost/types/apps';

describe('Apps Utils', () => {
    const basicCall: AppCall = {
        path: 'url',
    };
    const basicSubmitForm: AppForm = {
        submit: basicCall,
    };
    const basicFetchForm: AppForm = {
        source: basicCall,
    };

    describe('fillAndTrimBindingsInformation', () => {
        test('Apps IDs propagate down, and locations get formed', () => {
            const inBinding: AppBinding = {
                app_id: 'id',
                location: 'loc1',
                bindings: [
                    {
                        location: 'loc2',
                        bindings: [
                            {
                                location: 'loc3',
                                submit: basicCall,
                            },
                            {
                                location: 'loc4',
                                form: basicSubmitForm,
                            },
                        ],
                    },
                    {
                        location: 'loc5',
                        form: basicFetchForm,
                    },
                ],
            } as AppBinding;

            const outBinding: AppBinding = {
                app_id: 'id',
                location: 'loc1',
                bindings: [
                    {
                        location: 'loc1/loc2',
                        app_id: 'id',
                        label: 'loc2',
                        bindings: [
                            {
                                location: 'loc1/loc2/loc3',
                                app_id: 'id',
                                label: 'loc3',
                                submit: basicCall,
                            },
                            {
                                location: 'loc1/loc2/loc4',
                                app_id: 'id',
                                label: 'loc4',
                                form: basicSubmitForm,
                            },
                        ],
                    },
                    {
                        location: 'loc1/loc5',
                        app_id: 'id',
                        label: 'loc5',
                        form: basicFetchForm,
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, '');
            expect(inBinding).toEqual(outBinding);
        });

        test('Trim branches without call.', () => {
            const inBinding: AppBinding = {
                location: 'loc1',
                app_id: 'id',
                bindings: [
                    {
                        location: 'loc2',
                        bindings: [
                            {
                                location: 'loc3',
                            },
                            {
                                location: 'loc4',
                                form: basicSubmitForm,
                            },
                            {
                                location: 'loc5',
                                form: basicFetchForm,
                            },
                        ],
                    },
                    {
                        location: 'loc6',
                    },
                    {
                        location: 'loc7',
                        submit: basicCall,
                    },
                    {
                        location: 'loc8',
                        form: {},
                    },
                ],
            } as AppBinding;

            const outBinding: AppBinding = {
                app_id: 'id',
                location: 'loc1',
                bindings: [
                    {
                        location: 'loc1/loc2',
                        app_id: 'id',
                        label: 'loc2',
                        bindings: [
                            {
                                location: 'loc1/loc2/loc4',
                                app_id: 'id',
                                form: basicSubmitForm,
                                label: 'loc4',
                            },
                            {
                                location: 'loc1/loc2/loc5',
                                app_id: 'id',
                                form: basicFetchForm,
                                label: 'loc5',
                            },
                        ],
                    },
                    {
                        location: 'loc1/loc7',
                        app_id: 'id',
                        submit: basicCall,
                        label: 'loc7',
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, '');
            expect(inBinding).toEqual(outBinding);
        });
        test('Trim branches with calls, bindings and forms.', () => {
            const inBinding: AppBinding = {
                location: 'loc1',
                app_id: 'id',
                bindings: [
                    {
                        location: 'loc2',
                        bindings: [
                            {
                                location: 'loc3',
                                submit: basicCall,
                                form: basicSubmitForm,
                            },
                            {
                                location: 'loc4',
                                form: basicSubmitForm,
                            },
                            {
                                location: 'loc5',
                                form: basicFetchForm,
                            },
                        ],
                    },
                    {
                        location: 'loc6',
                        submit: basicCall,
                        bindings: [
                            {
                                location: 'loc9',
                                submit: basicCall,
                            },
                        ],
                    },
                    {
                        location: 'loc7',
                        submit: basicCall,
                    },
                    {
                        location: 'loc8',
                        form: basicFetchForm,
                        bindings: [
                            {
                                location: 'loc10',
                                submit: basicCall,
                            },
                        ],
                    },
                ],
            } as AppBinding;

            const outBinding: AppBinding = {
                app_id: 'id',
                location: 'loc1',
                bindings: [
                    {
                        location: 'loc1/loc2',
                        app_id: 'id',
                        label: 'loc2',
                        bindings: [
                            {
                                location: 'loc1/loc2/loc4',
                                app_id: 'id',
                                form: basicSubmitForm,
                                label: 'loc4',
                            },
                            {
                                location: 'loc1/loc2/loc5',
                                app_id: 'id',
                                form: basicFetchForm,
                                label: 'loc5',
                            },
                        ],
                    },
                    {
                        location: 'loc1/loc7',
                        app_id: 'id',
                        submit: basicCall,
                        label: 'loc7',
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, '');
            expect(inBinding).toEqual(outBinding);
        });
        test('Trim branches with whitespace labels.', () => {
            const inBinding: AppBinding = {
                location: 'loc1',
                app_id: 'id',
                bindings: [
                    {
                        location: 'loc2',
                        label: ' ',
                        bindings: [
                            {
                                location: 'loc4',
                                form: basicSubmitForm,
                            },
                            {
                                location: 'loc5',
                                form: basicFetchForm,
                            },
                        ],
                    },
                ],
            } as AppBinding;

            const outBinding: AppBinding = {
                app_id: 'id',
                location: 'loc1',
                bindings: [] as AppBinding[],
            } as AppBinding;

            cleanBinding(inBinding, '');
            expect(inBinding).toEqual(outBinding);
        });
    });
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
    describe('cleanCommands', () => {
        test('happy path', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: 'loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: 'loc11',
                                label: 'loc11',
                                submit: basicCall,
                            },
                            {
                                app_id: 'app',
                                location: 'loc12',
                                label: 'loc12',
                                form: basicSubmitForm,
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: 'loc2',
                        label: 'loc2',
                        form: basicFetchForm,
                    },
                ],
            } as AppBinding;
            const outBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: '/command/loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: '/command/loc1/loc11',
                                label: 'loc11',
                                submit: basicCall,
                            },
                            {
                                app_id: 'app',
                                location: '/command/loc1/loc12',
                                label: 'loc12',
                                form: basicSubmitForm,
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: '/command/loc2',
                        label: 'loc2',
                        form: basicFetchForm,
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, AppBindingLocations.COMMAND);
            expect(inBinding).toEqual(outBinding);
        });
        test('no label nor location', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: 'loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: 'loc11',
                                label: 'loc11',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                            {
                                app_id: 'app',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            } as AppBinding,
                        ],
                    },
                    {
                        app_id: 'app',
                        location: 'loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;
            const outBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: '/command/loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: '/command/loc1/loc11',
                                label: 'loc11',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: '/command/loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, AppBindingLocations.COMMAND);
            expect(inBinding).toEqual(outBinding);
        });
        test('no multiword infered from location', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: 'loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: 'loc11',
                                label: 'loc11',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                            {
                                app_id: 'app',
                                location: 'loc1 2',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            } as AppBinding,
                        ],
                    },
                    {
                        app_id: 'app',
                        location: 'loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;
            const outBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: '/command/loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: '/command/loc1/loc11',
                                label: 'loc11',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: '/command/loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, AppBindingLocations.COMMAND);
            expect(inBinding).toEqual(outBinding);
        });
        test('no multiword on label', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: 'loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: 'loc11',
                                label: 'loc11',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                            {
                                app_id: 'app',
                                location: 'loc12',
                                label: 'loc1 2',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: 'loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;
            const outBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: '/command/loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: '/command/loc1/loc11',
                                label: 'loc11',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: '/command/loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, AppBindingLocations.COMMAND);
            expect(inBinding).toEqual(outBinding);
        });
        test('filter repeated label', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: 'loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: 'same',
                                description: 'loc11',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            } as AppBinding,
                            {
                                app_id: 'app',
                                location: 'same',
                                description: 'loc12',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            } as AppBinding,
                        ],
                    },
                    {
                        app_id: 'app',
                        location: 'loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;
            const outBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: '/command/loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: '/command/loc1/same',
                                label: 'same',
                                description: 'loc11',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            } as AppBinding,
                        ],
                    },
                    {
                        app_id: 'app',
                        location: '/command/loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, AppBindingLocations.COMMAND);
            expect(inBinding).toEqual(outBinding);
        });
        test('filter with same label', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: 'loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: 'loc11',
                                label: 'same',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                            {
                                app_id: 'app',
                                location: 'loc12',
                                label: 'same',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: 'loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;
            const outBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: '/command/loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: '/command/loc1/loc11',
                                label: 'same',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: '/command/loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, AppBindingLocations.COMMAND);
            expect(inBinding).toEqual(outBinding);
        });
        test('non-leaf command removed when it has no subcommands', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: 'loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: 'loc11',
                                label: 'loc 1 1',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: 'loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;
            const outBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: '/command/loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;

            cleanBinding(inBinding, AppBindingLocations.COMMAND);
            expect(inBinding).toEqual(outBinding);
        });
    });

    describe('validateBindings', () => {
        test('return validated binding when bindings are NOT empty', () => {
            const outBinding: AppBinding = {
                location: '/command',
                bindings: [
                    {
                        app_id: 'app',
                        location: '/command/loc1',
                        label: 'loc1',
                        bindings: [
                            {
                                app_id: 'app',
                                location: '/command/loc1/loc11',
                                label: 'same',
                                form: {
                                    submit: {
                                        path: '/path',
                                    },
                                },
                            },
                        ],
                    },
                    {
                        app_id: 'app',
                        location: '/command/loc2',
                        label: 'loc2',
                        form: {
                            submit: {
                                path: '/path',
                            },
                        },
                    },
                ],
            } as AppBinding;

            const bindings = validateBindings([outBinding]);
            expect([outBinding]).toEqual(bindings);
        });

        test('return empty array when bindings are empty', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: [] as AppBinding[],
            } as AppBinding;

            const bindings = validateBindings([inBinding]);
            expect([]).toEqual(bindings);
        });

        test('return empty array when bindings is NULL', () => {
            const inBinding: AppBinding = {
                location: '/command',
                bindings: null,
            } as unknown as AppBinding;

            const bindings = validateBindings([inBinding]);
            expect([]).toEqual(bindings);
        });
    });
});
