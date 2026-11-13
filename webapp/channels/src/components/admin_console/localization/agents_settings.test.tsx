// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {LLMService} from '@mattermost/types/agents';
import type {AutoTranslationSettings} from '@mattermost/types/config';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import AgentsSettings from './agents_settings';

import type {SystemConsoleCustomSettingsComponentProps} from '../schema_admin_settings';

jest.mock('mattermost-redux/actions/agents', () => ({
    getLLMServices: () => ({type: 'MOCK_GET_LLM_SERVICES'}),
}));

const services: LLMService[] = [
    {id: 'svcopenai00000000000000000', name: 'OpenAI', type: 'openai'},
    {id: 'svcanthropic00000000000000', name: 'Anthropic', type: 'anthropic'},
];

const unavailableErrorText = 'The selected AI service is no longer available in the Agents plugin. Select an available service and save.';

function renderAgentsSettings(llmServiceID: string, llmServices: LLMService[] = services) {
    const onChange = jest.fn();
    const props = {
        id: 'AutoTranslationSettings',
        value: {Agents: {LLMServiceID: llmServiceID}} as AutoTranslationSettings,
        disabled: false,
        setByEnv: false,
        onChange,
    } as unknown as SystemConsoleCustomSettingsComponentProps;

    renderWithContext(
        <AgentsSettings {...props}/>,
        {entities: {agents: {agents: [], agentsStatus: {available: true}, llmServices}}},
    );

    return {onChange, select: screen.getByTestId('LLMServiceIDdropdown') as HTMLSelectElement};
}

describe('components/admin_console/localization/AgentsSettings', () => {
    test('selects the saved service when it is available', () => {
        const {onChange, select} = renderAgentsSettings('svcanthropic00000000000000');

        expect(select).toHaveValue('svcanthropic00000000000000');
        expect(screen.getByRole('option', {name: 'Anthropic'})).toHaveProperty('selected', true);
        expect(screen.queryByText(unavailableErrorText)).not.toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    test('shows a saved service that no longer exists as unavailable instead of the first service', () => {
        const staleID = 'e2d1eb35-63a6-4589-a86d-af33852883d8';
        const {onChange, select} = renderAgentsSettings(staleID);

        expect(select).toHaveValue(staleID);
        expect(screen.getByRole('option', {name: `Unavailable service (${staleID})`})).toHaveProperty('selected', true);
        expect(screen.getByRole('option', {name: 'OpenAI'})).toHaveProperty('selected', false);
        expect(screen.getByText(unavailableErrorText)).toBeVisible();
        expect(onChange).not.toHaveBeenCalled();
    });

    test('lets the admin replace an unavailable service with the first listed service', async () => {
        const {onChange, select} = renderAgentsSettings('e2d1eb35-63a6-4589-a86d-af33852883d8');

        await userEvent.selectOptions(select, 'svcopenai00000000000000000');

        expect(onChange).toHaveBeenCalledWith('Agents', {LLMServiceID: 'svcopenai00000000000000000'});
        expect(select).toHaveValue('svcopenai00000000000000000');
        expect(screen.queryByRole('option', {name: /Unavailable service/})).not.toBeInTheDocument();
        expect(screen.queryByText(unavailableErrorText)).not.toBeInTheDocument();
    });

    test('does not flag the saved service while no services are listed', () => {
        renderAgentsSettings('svcopenai00000000000000000', []);

        expect(screen.queryByText(unavailableErrorText)).not.toBeInTheDocument();
        expect(screen.queryByRole('option', {name: /Unavailable service/})).not.toBeInTheDocument();
    });

    test('defaults to the first service when none is saved', () => {
        const {onChange} = renderAgentsSettings('');

        expect(onChange).toHaveBeenCalledWith('Agents', {LLMServiceID: 'svcopenai00000000000000000'});
        expect(screen.queryByText(unavailableErrorText)).not.toBeInTheDocument();
    });
});
