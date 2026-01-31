// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getConsoleAccess} from 'selectors/admin_console.jsx';

describe('Selectors.AdminConsole.getConsoleAccess', () => {
    it('should not crash when a plugin adds an unknown section', () => {
        const state = {
            entities: {
                roles: {
                    mySystemPermissions: new Set(['sysconsole_read_about_edition_and_license']),
                },
                general: {
                    license: {},
                },
            },
            plugins: {
                adminConsoleReducers: {
                    'plugin-id': (adminDefinition) => {
                        adminDefinition.unknown_section = {
                            subsections: {
                                unknown_subsection: {
                                    url: 'unknown/subsection',
                                    title: {id: 'unknown.title', defaultMessage: 'Unknown'},
                                    schema: {id: 'Unknown', component: () => null},
                                },
                            },
                        };
                        return adminDefinition;
                    },
                },
                adminConsoleCustomComponents: {},
                adminConsoleCustomSections: {},
            },
        };

        // This should not throw
        expect(() => getConsoleAccess(state)).not.toThrow();
        
        const access = getConsoleAccess(state);
        expect(access.read.unknown_section).toBeUndefined();
    });
});
