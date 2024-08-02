// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PluginConfiguration} from 'types/plugins/user_settings';

import {extractPluginConfiguration} from './plugin_setting_extraction';

function getFullExample(): PluginConfiguration {
    return {
        id: '',
        action: {
            buttonText: 'some button text',
            onClick: () => 1,
            text: 'some text',
            title: 'some title',
        },
        sections: [
            {
                settings: [
                    {
                        default: '1-1',
                        name: '1-1 name',
                        options: [
                            {
                                text: '1-1-1',
                                value: '1-1-1 value',
                                helpText: '1-1-1 help text',
                            },
                            {
                                text: '1-1-2',
                                value: '1-1-2 value',
                            },
                        ],
                        type: 'radio',
                        helpText: '1-1 help text',
                        title: '1-1 title',
                    },
                    {
                        default: '1-2',
                        name: '1-2 name',
                        options: [
                            {
                                text: '1-2-1',
                                value: '1-2-1 value',
                                helpText: '1-2-1 help text',
                            },
                        ],
                        type: 'radio',
                    },
                ],
                title: 'title 1',
                onSubmit: () => 1,
            },
            {
                settings: [
                    {
                        default: '2-1',
                        name: '2-1 name',
                        options: [
                            {
                                text: '2-1-1',
                                value: '2-1-1 value',
                                helpText: '2-1-1 help text',
                            },
                            {
                                text: '2-1-2',
                                value: '2-1-2 value',
                            },
                        ],
                        type: 'radio',
                        helpText: '2-1 help text',
                        title: '2-1 title',
                    },
                ],
                title: 'title 2',
                onSubmit: () => 2,
                disabled: true,
            },
        ],
        uiName: 'some name',
        icon: 'some icon',
    };
}
describe('plugin setting extraction', () => {
    it('happy path', () => {
        const config = getFullExample();
        const res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections).toHaveLength(2);
        expect(res?.sections[0].settings).toHaveLength(2);
        expect(res?.sections[1].settings).toHaveLength(1);
        expect(res?.sections[0].settings[0].options).toHaveLength(2);
    });

    it('id gets overridden', () => {
        const config: any = getFullExample();
        const pluginId = 'PluginId';
        config.id = 'otherId';
        let res = extractPluginConfiguration(config, pluginId);
        expect(res).toBeTruthy();
        expect(res!.id).toBe(pluginId);

        delete config.id;
        res = extractPluginConfiguration(config, pluginId);
        expect(res).toBeTruthy();
        expect(res!.id).toBe(pluginId);
    });

    it('action gets properly added', () => {
        const config = getFullExample();
        const res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.action).toBeTruthy();
        expect(res?.action?.buttonText).toBe(config.action?.buttonText);
        expect(res?.action?.text).toBe(config.action?.text);
        expect(res?.action?.title).toBe(config.action?.title);
        expect(res?.action?.onClick).toBe(config.action?.onClick);
    });

    it('sections get properly added', () => {
        const config = getFullExample();
        const res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections).toHaveLength(2);
        expect(res?.sections[0].disabled).toBe(config.sections[0].disabled);
        expect(res?.sections[0].title).toBe(config.sections[0].title);
        expect(res?.sections[0].onSubmit).toBe(config.sections[0].onSubmit);
        expect(res?.sections[0].settings).toHaveLength(config.sections[0].settings.length);
        expect(res?.sections[1].disabled).toBe(config.sections[1].disabled);
        expect(res?.sections[1].title).toBe(config.sections[1].title);
        expect(res?.sections[1].onSubmit).toBe(config.sections[1].onSubmit);
        expect(res?.sections[1].settings).toHaveLength(config.sections[1].settings.length);
    });

    it('reject configs without name', () => {
        const config: any = getFullExample();
        config.uiName = '';
        let res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeFalsy();

        delete config.uiName;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeFalsy();
    });

    it('filter out sections without a title', () => {
        const config: any = getFullExample();
        config.sections[0].title = '';
        let res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections).toHaveLength(1);

        delete config.sections[0].title;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections).toHaveLength(1);
    });

    it('filter out settings without a type', () => {
        const config: any = getFullExample();
        config.sections[0].settings[0].type = '';
        let res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);

        delete config.sections[0].settings[0].type;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);
    });

    it('filter out settings without a name', () => {
        const config: any = getFullExample();
        config.sections[0].settings[0].name = '';
        let res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);

        delete config.sections[0].settings[0].name;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);
    });

    it('filter out settings without a default value', () => {
        const config: any = getFullExample();
        config.sections[0].settings[0].default = '';
        let res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);

        delete config.sections[0].settings[0].default;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);
    });

    it('filter out radio options without a text', () => {
        const config: any = getFullExample();
        config.sections[0].settings[0].options[0].text = '';
        let res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings[0].options).toHaveLength(1);

        delete config.sections[0].settings[0].options[0].text;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings[0].options).toHaveLength(1);
    });

    it('filter out radio options without a value', () => {
        const config: any = getFullExample();
        config.sections[0].settings[0].options[0].value = '';
        let res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings[0].options).toHaveLength(1);

        delete config.sections[0].settings[0].options[0].value;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings[0].options).toHaveLength(1);
    });

    it('reject configs without valid sections', () => {
        const config = getFullExample();
        config.sections = [{
            settings: [],
            title: 'foo',
        }];

        const res: any = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeFalsy();
    });

    it('filter out invalid sections', () => {
        const config = getFullExample();
        config.sections.push({settings: [], title: 'foo'});
        const res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections).toHaveLength(2);
    });

    it('filter out sections without valid settings', () => {
        const config = getFullExample();
        config.sections[0].settings[0].options = [];
        config.sections[0].settings[1].options = [];
        const res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections).toHaveLength(1);
    });

    it('filter out invalid settings', () => {
        const config = getFullExample();
        config.sections[0].settings[0].options = [];
        const res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);
    });

    it('filter out radio settings without valid options', () => {
        const config = getFullExample();
        config.sections[0].settings[0].options[0].value = '';
        config.sections[0].settings[0].options[1].value = '';
        const res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);
    });

    it('filter out ill defined action', () => {
        let config: any = getFullExample();
        delete config.action?.buttonText;
        let res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.action).toBeFalsy();

        config = getFullExample();
        delete config.action?.title;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.action).toBeFalsy();

        config = getFullExample();
        delete config.action?.text;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.action).toBeFalsy();

        config = getFullExample();
        delete config.action?.onClick;
        res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.action).toBeFalsy();
    });

    it('(future proof) filter out extra config arguments', () => {
        const config: any = getFullExample();
        config.futureProperty = 'hello';
        const res: any = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res.futureProperty).toBeFalsy();
    });

    it('(future proof) filter out extra section arguments', () => {
        const config: any = getFullExample();
        config.sections[0].futureProperty = 'hello';
        const res: any = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res.sections).toHaveLength(2);
        expect(res.sections[0].futureProperty).toBeFalsy();
    });

    it('(future proof) filter out extra setting arguments', () => {
        const config: any = getFullExample();
        config.sections[0].settings[0].futureProperty = 'hello';
        const res: any = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res.sections[0].settings).toHaveLength(2);
        expect(res.sections[0].settings[0].futureProperty).toBeFalsy();
    });

    it('(future proof) filter out extra option arguments', () => {
        const config: any = getFullExample();
        config.sections[0].settings[0].options[0].futureProperty = 'hello';
        const res: any = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res.sections[0].settings[0].options).toHaveLength(2);
        expect(res.sections[0].settings[0].options[0].futureProperty).toBeFalsy();
    });

    it('(future proof) filter out unknown settings', () => {
        const config: any = getFullExample();
        config.sections[0].settings[0].type = 'newType';
        const res = extractPluginConfiguration(config, 'PluginId');
        expect(res).toBeTruthy();
        expect(res?.sections[0].settings).toHaveLength(1);
    });
});
