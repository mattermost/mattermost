// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import AdminDefinition from 'components/admin_console/admin_definition.jsx';

import {samplePlugin1, samplePlugin2} from 'tests/helpers/admin_console_plugin_index_sample_pluings';

import {generateIndex} from './admin_console_index';

const enMessages = require('../i18n/en');
const esMessages = require('../i18n/es');

describe('AdminConsoleIndex.generateIndex', () => {
    it('should generate an index where I can search', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const idx = generateIndex(AdminDefinition, intl, {});
        expect(idx.search('ldap')).toEqual([
            'environment/session_lengths',
            'authentication/mfa',
            'authentication/ldap',
            'authentication/saml',
            'experimental/features',
            'authentication/email',
            'authentication/guest_access',
        ]);
        expect(idx.search('saml')).toEqual([
            'authentication/saml',
            'environment/session_lengths',
            'authentication/email',
            'experimental/features',
        ]);
        expect(idx.search('nginx')).toEqual([
            'environment/rate_limiting',
        ]);
        expect(idx.search('characters')).toEqual([
            'site_config/customization',
            'authentication/password',
        ]);
        expect(idx.search('caracteres')).toEqual([]);
        expect(idx.search('notexistingword')).toEqual([]);
    });

    xit('should generate a index where I can search in other language', () => {
        const intl = createIntl({locale: 'es', messages: esMessages, defaultLocale: 'es'});

        const idx = generateIndex(AdminDefinition, intl, {});
        expect(idx.search('ldap').sort()).toEqual([
            'authentication/mfa',
            'authentication/ldap',
            'authentication/saml',
            'experimental/features',
            'authentication/email',
            'environment/session_lengths',
            'authentication/guest_access',
        ].sort());
        expect(idx.search('saml').sort()).toEqual([
            'authentication/saml',
            'environment/session_lengths',
            'authentication/email',
            'experimental/features',
        ].sort());
        expect(idx.search('nginx')).toEqual([
            'environment/rate_limiting',
        ]);
        expect(idx.search('caracteres').sort()).toEqual([
            'site_config/customization',
            'authentication/password',
        ].sort());
        expect(idx.search('characters')).toEqual([]);
        expect(idx.search('notexistingword')).toEqual([]);
    });

    it('should generate a index including the plugin settings', () => {
        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});

        const idx = generateIndex(AdminDefinition, intl, {[samplePlugin1.id]: samplePlugin1, [samplePlugin2.id]: samplePlugin2});

        expect(idx.search('random')).toEqual(['plugin_Some-random-plugin', 'site_config/public_links']);
        expect(idx.search('autolink')).toEqual(['plugin_mattermost-autolink']);
    });
});
