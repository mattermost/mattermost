// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {savePlaybook} from 'src/client';
import {StyledSelect} from 'src/components/backstage/styles';
import {setPlaybookDefaults} from 'src/types/playbook';
import {usePlaybooksRouting} from 'src/hooks';

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

import TemplateItem from './template_item';
import PresetTemplates, {PresetTemplate} from './template_data';

const presetTemplateOptions = PresetTemplates.map((template: PresetTemplate) => ({label: template.title, value: template.title}));

interface Props {
    templates?: PresetTemplate[];
}

interface TemplateDropdownProps {
    template?: string
    onTemplateSet: (template?: string) => void
}

export const TemplateDropdown = (props: TemplateDropdownProps) => {
    const {formatMessage} = useIntl();

    const handleTemplateSet = (option: {value: string}) => {
        props.onTemplateSet(option.value);
    };

    return (
        <StyledSelect
            filterOption={null}
            isMulti={false}
            placeholder={formatMessage({defaultMessage: 'Select an example'})}
            onChange={handleTemplateSet}
            options={presetTemplateOptions}
            value={presetTemplateOptions.find((val) => val.value === props?.template)}
            isClearable={false}
            maxMenuHeight={380}
        />
    );
};

const SelectorGrid = styled.div`
	display: grid;
    padding: 0 0 100px;
    gap: 2.5rem;
	grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    place-items: flex-start center;
`;

const instantCreatePlaybook = async (template: PresetTemplate, teamID: string, username: string): Promise<string> => {
    const pb = setPlaybookDefaults(template.template);
    pb.public = true;
    pb.team_id = teamID;
    if (username !== '') {
        pb.title = '@' + username + "'s " + template.title;
    }
    const data = await savePlaybook(pb);

    return data?.id;
};

const TemplateSelector = ({templates = PresetTemplates}: Props) => {
    const teamId = useSelector(getCurrentTeamId);
    const currentUser = useSelector(getCurrentUser);
    const {edit} = usePlaybooksRouting();
    const refreshLHS = useLHSRefresh();

    return (
        <SelectorGrid>
            {templates.map((template: PresetTemplate) => (
                <TemplateItem
                    key={template.title}
                    label={template.label}
                    title={template.title}
                    description={template.description ?? ''}
                    color={template.color}
                    icon={template.icon}
                    author={template.author}
                    labelColor={template.labelColor}
                    onSelect={async () => {
                        let username = currentUser.username;
                        const isTutorial = template.title === 'Learn how to use playbooks';
                        if (isTutorial) {
                            username = '';
                        }
                        const playbookID = await instantCreatePlaybook(template, teamId, username);
                        refreshLHS();
                        edit(playbookID);
                    }}
                />
            ))}

        </SelectorGrid>
    );
};

export default TemplateSelector;
