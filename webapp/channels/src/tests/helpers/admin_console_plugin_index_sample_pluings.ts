// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const samplePlugin1 = {
    id: 'mattermost-autolink',
    name: 'Autolink',
    description: 'Automatically rewrite text matching a regular expression into a Markdown link.',
    version: '1.1.0',
    settings_schema: {
        header: 'Configure this plugin directly in the config.json file. Learn more [in our documentation](https://github.com/mattermost/mattermost-plugin-autolink/blob/master/README.md).\n\nTo report an issue, make a suggestion or a contribution, [check the plugin repository](https://github.com/mattermost/mattermost-plugin-autolink).',
        footer: '',
        settings: [
            {
                key: 'EnableAdminCommand',
                display_name: 'Enable administration with /autolink command',
                type: 'bool',
                help_text: '',
                placeholder: '',
                default: false,
            },
        ],
    },
    active: true,
};

export const samplePlugin2 = {
    id: 'Some-random-plugin',
    name: 'Random',
    description: 'Automatically generate random numbers',
    version: '1.1.0',
    settings_schema: {
        header: 'random plugin header',
        footer: 'random plugin footer',
        settings: [
            {
                key: 'GenerateRandomNumber',
                display_name: 'Generate with /generateRand command',
                type: 'bool',
                help_text: '/generateRand 10',
                placeholder: '',
                default: false,
            },
            {
                key: 'setRange',
                display_name: 'set range with /setRange command',
                type: 'bool',
                help_text: '',
                placeholder: '',
                default: false,
            },
        ],
    },
    active: true,
};

export const samplePlugin3 = {
    id: 'plugin-with-markdown',
    name: 'markdown',
    description: 'click [here](http://localhost:8080)',
    version: '1.1.0',
    settings_schema: {
        header: 'random plugin header',
        footer: 'random plugin footer',
        settings: [
            {
                label: 'Markdown plugin label',
                key: 'Markdown plugin',
                display_name: 'Markdown',
                type: 'bool',
                help_text: 'click [here](http://localhost:8080)',
                placeholder: '',
                default: false,
            },
        ],
    },
    active: true,
};

export const samplePlugin4 = {
    id: 'plugin-without-settings',
    name: 'without-settings',
    description: 'click [here](http://localhost:8080)',
    version: '1.1.0',
    settings_schema: {
        header: 'random plugin header',
        footer: 'random plugin footer',
        settings: [],
    },
    active: true,
};
