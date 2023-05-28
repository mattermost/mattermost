// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import classnames from 'classnames';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import LocalizedIcon from 'components/localized_icon';
import {TTNameMapToATStatusKey, TutorialTourName} from 'components/tours/constant';

import {closeModal as closeModalAction} from 'actions/views/modals';
import {trackEvent} from 'actions/telemetry_actions';
import {showRHSPlugin} from 'actions/views/rhs';
import {fetchRemoteListing} from 'actions/marketplace';
import {loadIfNecessaryAndSwitchToChannelById} from 'actions/views/channel';

import {
    clearCategories,
    clearWorkTemplates,
    executeWorkTemplate,
    getWorkTemplateCategories,
    getWorkTemplates,
    onExecuteSuccess,
} from 'mattermost-redux/actions/work_templates';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {ActionResult} from 'mattermost-redux/types/actions';
import {savePreferences} from 'mattermost-redux/actions/preferences';

import {
    Category,
    ExecuteWorkTemplateRequest,
    ExecuteWorkTemplateResponse,
    Visibility,
    WorkTemplate,
} from '@mattermost/types/work_templates';

import {GlobalState} from 'types/store';

import {ModalIdentifiers, suitePluginIds, TELEMETRY_CATEGORIES} from 'utils/constants';

import {AutoTourStatus} from 'components/tours';

import Customize from './components/customize';
import Menu from './components/menu';
import GenericModal from './components/modal';
import Preview from './components/preview';
import {useGetRHSPluggablesIds} from './hooks';
import {getContentCount} from './utils';

const BackIconInHeader = styled(LocalizedIcon)`
    font-size: 24px;
    line-height: 24px;
    color: rgba(var(--center-channel-text-rbg), 0.56);
    cursor: pointer;

    &::before {
        margin-left: 0;
        margin-right: 0;
    }
`;

interface ModalTitleProps {
    text: string;
    backArrowAction?: () => void;
}

const ModalTitle = (props: ModalTitleProps) => {
    return (
        <div className='work-template-modal__title'>
            {props.backArrowAction &&
                <BackIconInHeader
                    className='icon icon-arrow-left'
                    aria-label={'Back Icon'}
                    onClick={props.backArrowAction}
                />
            }
            <span style={{marginLeft: 18}}>{props.text}</span>
        </div>
    );
};

enum ModalState {
    Menu = 'menu',
    Customize = 'customize',
    Preview = 'preview',
}

const WorkTemplateModal = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [modalState, setModalState] = useState(ModalState.Menu);
    const [selectedTemplate, setSelectedTemplate] = useState<WorkTemplate | null>(null);
    const [selectedName, setSelectedName] = useState<string>('');
    const [selectedVisibility, setSelectedVisibility] = useState(Visibility.Public);
    const [currentCategoryId, setCurrentCategoryId] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [errorText, setErrorText] = useState('');

    const categories = useSelector((state: GlobalState) => state.entities.worktemplates.categories);
    const workTemplates = useSelector((state: GlobalState) => state.entities.worktemplates.templatesInCategory);
    const config = useSelector(getConfig);
    const pluginsEnabled = config.PluginsEnabled === 'true' && config.EnableMarketplace === 'true' && config.IsDefaultMarketplace === 'true';
    const teamId = useSelector(getCurrentTeamId);
    const playbookTemplates = useSelector((state: GlobalState) => state.entities.worktemplates.playbookTemplates);
    const {rhsPluggableIds} = useGetRHSPluggablesIds();
    const currentUserId = useSelector(getCurrentUserId);

    useEffect(() => {
        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'open_modal');
    }, []);

    // load the categories if they are not found, or load the work templates for those categories.
    useEffect(() => {
        if (categories?.length) {
            setCurrentCategoryId(categories[0].id);
            dispatch(getWorkTemplates(categories[0].id));
            return;
        }
        dispatch(getWorkTemplateCategories());
    }, [dispatch, categories]);

    useEffect(() => {
        if (pluginsEnabled) {
            dispatch(fetchRemoteListing());
        }
    }, [dispatch, pluginsEnabled]);

    useEffect(() => {
        return () => {
            dispatch(clearCategories());
            dispatch(clearWorkTemplates());
        };
    }, [dispatch]);

    // error resetter
    useEffect(() => {
        setErrorText('');
    }, [currentCategoryId, modalState, selectedTemplate, selectedVisibility, selectedName]);

    const changeCategory = (category: Category) => {
        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'change_category', {category: category.id});
        setCurrentCategoryId(category.id);
        if (workTemplates[category.id]?.length) {
            return;
        }
        dispatch(getWorkTemplates(category.id));
    };

    const closeModal = () => {
        dispatch(closeModalAction(ModalIdentifiers.WORK_TEMPLATE));
    };

    const goToMenu = () => {
        setModalState(ModalState.Menu);
        setSelectedTemplate(null);
    };

    const handleTemplateSelected = (template: WorkTemplate, quickUse: boolean) => {
        setSelectedTemplate(template);
        if (quickUse) {
            trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'quick_use', {category: template.category, template: template.id});
            execute(template, '', template.visibility);
            return;
        }

        // clear the name and set default visibility
        setSelectedName('');
        setSelectedVisibility(template.visibility);

        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'select_template', {category: template.category, template: template.id});
        setModalState(ModalState.Preview);
    };

    const handleOnNameChanged = (name: string) => {
        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'customize_name', {category: selectedTemplate?.category, template: selectedTemplate?.id});
        setSelectedName(name);
    };

    const handleOnVisibilityChanged = (visibility: Visibility) => {
        if (visibility === Visibility.Public) {
            trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'changed_visibility_public', {category: selectedTemplate?.category, template: selectedTemplate?.id});
        } else {
            trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'customized_visibility_private', {category: selectedTemplate?.category, template: selectedTemplate?.id});
        }

        setSelectedVisibility(visibility);
    };

    /**
     * Creates the necessary data in the global store as long storing in DB preferences the tourtip information
     * @param template current used worktempplate
     */
    const tourTipActions = async (template: WorkTemplate, firstChannelId: string) => {
        const linkedProductsCount = getContentCount(template, playbookTemplates, firstChannelId);

        // stepValue and pluginId are used for showing the tourtip for the used template
        let pluginId;
        if (linkedProductsCount.playbooks) {
            pluginId = rhsPluggableIds.get(suitePluginIds.playbooks);
        } else {
            pluginId = rhsPluggableIds.get(suitePluginIds.boards);
        }

        if (!pluginId) {
            return;
        }

        // store in the global state the plugins/integrations information related to the used template
        // so we can display that data in the tourtip
        await dispatch(onExecuteSuccess(linkedProductsCount));

        // store the required preferences for the tourtip
        const tourCategory = TutorialTourName.WORK_TEMPLATE_TUTORIAL;

        const preferences = [
            {
                user_id: currentUserId,
                category: tourCategory,
                name: TTNameMapToATStatusKey[tourCategory],
                value: String(AutoTourStatus.ENABLED),
            },
        ];
        await dispatch(savePreferences(currentUserId, preferences));

        dispatch(showRHSPlugin(pluginId));
    };

    const execute = async (template: WorkTemplate, name = '', visibility: Visibility) => {
        const pbTemplates = [];
        for (const ctt in template.content) {
            if (!Object.hasOwn(template.content, ctt)) {
                continue;
            }

            const item = template.content[ctt];
            if (item.playbook) {
                const pbTemplate = playbookTemplates.find((pb) => pb.title === item.playbook.template);
                if (pbTemplate) {
                    pbTemplates.push(pbTemplate);
                }
            }
        }

        // remove non recommended integrations
        const filteredTemplate = {...template};
        filteredTemplate.content = template.content.filter((item) => {
            if (!item.integration) {
                return true;
            }
            return item.integration.recommended;
        });

        const req: ExecuteWorkTemplateRequest = {
            team_id: teamId,
            name,
            visibility,
            work_template: filteredTemplate,
            playbook_templates: pbTemplates,
        };

        setIsCreating(true);
        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'executing', {category: template.category, template: template.id, customized_name: name !== '', customized_visibility: visibility !== template.visibility});
        const {data, error} = await dispatch(executeWorkTemplate(req)) as ActionResult<ExecuteWorkTemplateResponse>;

        if (error) {
            trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'execution_error', {category: template.category, template: template.id, customized_name: name !== '', customized_visibility: visibility !== template.visibility, error: error.message});
            setErrorText(error.message);
            return;
        }

        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, 'execution_success', {category: template.category, template: template.id, customized_name: name !== '', customized_visibility: visibility !== template.visibility});
        let firstChannelId = '';

        if (data?.channel_with_playbook_ids.length) {
            firstChannelId = data.channel_with_playbook_ids[0];
        } else if (data?.channel_ids.length) {
            firstChannelId = data.channel_ids[0];
        }

        if (firstChannelId) {
            dispatch(loadIfNecessaryAndSwitchToChannelById(firstChannelId));
        }

        await tourTipActions(template, firstChannelId);

        setIsCreating(false);
        closeModal();
    };

    const trackAction = (action: string, actionFn: () => void) => {
        return () => {
            let props = {};
            if (selectedTemplate) {
                props = {category: selectedTemplate?.category, template: selectedTemplate?.id};
            }
            trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, action, props);

            actionFn();
        };
    };

    let title;
    let cancelButtonText;
    let cancelButtonAction;
    let backArrowAction;
    let confirmButtonText;
    let confirmButtonAction;
    switch (modalState) {
    case ModalState.Menu:
        title = formatMessage({id: 'work_templates.menu.modal_title', defaultMessage: 'Create from a template'});
        break;
    case ModalState.Preview:
        title = formatMessage({id: 'work_templates.preview.modal_title', defaultMessage: 'Preview {useCase}'}, {useCase: selectedTemplate?.useCase});
        cancelButtonText = formatMessage({id: 'work_templates.preview.modal_cancel_button', defaultMessage: 'Back'});
        cancelButtonAction = trackAction('btn_back_to_menu', goToMenu);
        backArrowAction = trackAction('arrow_back_to_menu', goToMenu);
        confirmButtonText = formatMessage({id: 'work_templates.preview.modal_next_button', defaultMessage: 'Next'});
        confirmButtonAction = trackAction('btn_go_to_customize', () => setModalState(ModalState.Customize));
        break;
    case ModalState.Customize:
        title = formatMessage({id: 'work_templates.customize.modal_title', defaultMessage: 'Name your {useCase}'}, {useCase: selectedTemplate?.useCase});
        cancelButtonText = formatMessage({id: 'work_templates.customize.modal_cancel_button', defaultMessage: 'Back'});
        cancelButtonAction = trackAction('btn_back_to_preview', () => setModalState(ModalState.Preview));
        backArrowAction = trackAction('arrow_back_to_preview', () => setModalState(ModalState.Preview));
        confirmButtonText = formatMessage({id: 'work_templates.customize.modal_create_button', defaultMessage: 'Create'});
        confirmButtonAction = trackAction('btn_execute', () => execute(selectedTemplate!, selectedName, selectedVisibility));
        break;
    }

    return (
        <GenericModal
            id='work-template-modal'
            className={classnames('work-template-modal', `work-template-modal--${modalState}`)}
            modalHeaderText={
                <ModalTitle
                    text={title}
                    backArrowAction={backArrowAction}
                />
            }
            compassDesign={true}
            onExited={closeModal}
            cancelButtonText={cancelButtonText}
            handleCancel={cancelButtonAction}
            confirmButtonText={confirmButtonText}
            handleConfirm={confirmButtonAction}
            isConfirmDisabled={isCreating || (modalState === ModalState.Customize && errorText !== '')}
            autoCloseOnCancelButton={false}
            autoCloseOnConfirmButton={false}
            errorText={errorText}
        >
            {modalState === ModalState.Menu && (
                <Menu
                    categories={categories}
                    onTemplateSelected={handleTemplateSelected}
                    changeCategory={changeCategory}
                    workTemplates={workTemplates}
                    currentCategoryId={currentCategoryId}
                    disableQuickUse={isCreating}
                />
            )}
            {(modalState === ModalState.Preview && selectedTemplate) && (
                <Preview
                    template={selectedTemplate}
                    pluginsEnabled={pluginsEnabled}
                />
            )}
            {(modalState === ModalState.Customize && selectedTemplate) && (
                <Customize
                    name={selectedName}
                    visibility={selectedVisibility}
                    onNameChanged={handleOnNameChanged}
                    onVisibilityChanged={handleOnVisibilityChanged}
                    template={selectedTemplate}
                />
            )}
        </GenericModal>
    );
};

export default WorkTemplateModal;
