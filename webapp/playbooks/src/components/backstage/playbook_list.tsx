// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import React, {PropsWithChildren, ReactNode, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {Redirect} from 'react-router-dom';

import {displayPlaybookCreateModal} from 'src/actions';
import {PrimaryButton, TertiaryButton} from 'src/components/assets/buttons';
import BackstageListHeader from 'src/components/backstage/backstage_list_header';
import PlaybookListRow from 'src/components/backstage/playbook_list_row';
import SearchInput from 'src/components/backstage/search_input';
import {BackstageSubheader, HorizontalSpacer} from 'src/components/backstage/styles';
import TemplateSelector from 'src/components/templates/template_selector';
import {PaginationRow} from 'src/components/pagination_row';
import {SortableColHeader} from 'src/components/sortable_col_header';
import {BACKSTAGE_LIST_PER_PAGE} from 'src/constants';
import {useCanCreatePlaybooksInTeam, usePlaybooksCrud, usePlaybooksRouting} from 'src/hooks';
import {useImportPlaybook} from 'src/components/backstage/import_playbook';
import {Playbook} from 'src/types/playbook';
import PresetTemplates from 'src/components/templates/template_data';
import {RegularHeading} from 'src/styles/headings';
import {pluginUrl} from 'src/browser_routing';

import Header from 'src/components/widgets/header';

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

import {ToastStyle} from 'src/components/backstage/toast';
import {useToaster} from 'src/components/backstage/toast_banner';

import {useFileDragDetection} from 'src/components/backstage/file_drag_detection';
import {FileUploadOverlay} from 'src/components/backstage/file_upload_overlay';

import CheckboxInput from './runs_list/checkbox_input';
import useConfirmPlaybookArchiveModal from './archive_playbook_modal';
import NoContentPage from './playbook_list_getting_started';
import useConfirmPlaybookRestoreModal from './restore_playbook_modal';

const ContainerMedium = styled.article`
    padding: 0 20px;
    scroll-margin-top: 20px;
`;

const PlaybookListContainer = styled.div`
    color: rgba(var(--center-channel-color-rgb), 0.9);
    position: relative;
    height: 100%;
    overflow-y: hidden;
`;

const ScrollContainer = styled.div`
  height: 100%;
  overflow-y: auto;
`;

const TableContainer = styled.div`
    overflow-x: hidden;
    overflow-x: clip;
`;

const CreatePlaybookHeader = styled(BackstageSubheader)`
    margin-top: 4rem;
    padding: 4rem 0 3.2rem;
    display: grid;
    justify-items: space-between;
`;

export const Heading = styled.h1`
    ${RegularHeading} {
    }
    font-size: 2.8rem;
    line-height: 3.6rem;
    margin: 0;
`;

const Sub = styled.p`
    font-size: 16px;
    line-height: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-weight: 400;
    max-width: 650px;
    margin-top: 12px;
`;

const AltCreatePlaybookHeader = styled(BackstageSubheader)`
    margin-top: 1rem;
    padding-top: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
`;

export const AltHeading = styled(Heading)`
    font-weight: 600;
    font-size: 20px;
    line-height: 28px;
    text-align: center;
`;

const AltSub = styled(Sub)`
    text-align: center;
    margin-bottom: 36px;
`;

const TitleActions = styled.div`
    display: flex;
`;

const ImportSub = styled(Sub)`
    margin-top: 8px;
    margin-bottom: 0;
    font-size: 14px;
    line-height: 20px;
    color: inherit;
`;

const ImportLink = styled.a`
    font-weight: 600;
`;

const PlaybooksListFilters = styled.div`
    display: flex;
    padding: 16px;
    align-items: center;
`;

const PlaybookList = (props: { firstTimeUserExperience?: boolean }) => {
    const {formatMessage} = useIntl();
    const teamId = useSelector(getCurrentTeamId);
    const canCreatePlaybooks = useCanCreatePlaybooksInTeam(teamId);
    const content = useRef<JSX.Element | null>(null);
    const selectorRef = useRef<HTMLDivElement>(null);
    const refreshLHS = useLHSRefresh();
    const addToast = useToaster().add;

    const {
        playbooks,
        isLoading, totalCount, params,
        setPage, sortBy, setSelectedPlaybook, archivePlaybook, restorePlaybook, duplicatePlaybook, setSearchTerm, isFiltering, setWithArchived, fetchPlaybooks,
    } = usePlaybooksCrud({per_page: BACKSTAGE_LIST_PER_PAGE});

    const [confirmArchiveModal, openConfirmArchiveModal] = useConfirmPlaybookArchiveModal(archivePlaybook);
    const [confirmRestoreModal, openConfirmRestoreModal] = useConfirmPlaybookRestoreModal(restorePlaybook);

    const {view, edit} = usePlaybooksRouting<string>({onGo: setSelectedPlaybook});
    const [fileInputRef, inputImportPlaybook, importPlaybookFile] = useImportPlaybook(teamId, (id: string) => {
        refreshLHS();
        edit(id);
    });

    const isDraggingFile = useFileDragDetection();

    const hasPlaybooks = Boolean(playbooks?.length);

    if (props.firstTimeUserExperience && hasPlaybooks) {
        return <Redirect to={pluginUrl('/playbooks')}/>;
    }

    const scrollToTemplates = () => {
        selectorRef.current?.scrollIntoView({behavior: 'smooth'});
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleImportDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleImportDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!e.dataTransfer.files?.[0]) {
            return;
        }
        if (e.dataTransfer.files.length > 1) {
            addToast({
                content: formatMessage({defaultMessage: 'Can not import multiple files at once.'}),
                toastStyle: ToastStyle.Failure,
            });
            return;
        }
        importPlaybookFile(e.dataTransfer.files[0]);
    };

    let listBody: JSX.Element | JSX.Element[] | null = null;
    if (!hasPlaybooks && isFiltering) {
        listBody = (
            <div className='text-center pt-8'>
                <FormattedMessage defaultMessage='There are no playbooks matching those filters.'/>
            </div>
        );
    } else if (playbooks) {
        listBody = playbooks.map((p: Playbook) => (
            <PlaybookListRow
                key={p.id}
                playbook={p}
                onClick={() => view(p.id)}
                onEdit={() => edit(p.id)}
                onRestore={() => openConfirmRestoreModal({id: p.id, title: p.title})}
                onArchive={() => openConfirmArchiveModal(p)}
                onDuplicate={() => duplicatePlaybook(p.id).then(refreshLHS)}
                onMembershipChanged={() => fetchPlaybooks()}
            />
        ));
    }

    const makePlaybookList = () => {
        if (props.firstTimeUserExperience || (!hasPlaybooks && !isFiltering)) {
            return (
                <>
                    <NoContentPage
                        canCreatePlaybooks={canCreatePlaybooks}
                        scrollToNext={scrollToTemplates}
                    />
                    {inputImportPlaybook}
                </>
            );
        }

        return (
            <TableContainer>
                <Header
                    data-testid='titlePlaybook'
                    level={2}
                    heading={formatMessage({defaultMessage: 'Playbooks'})}
                    subtitle={formatMessage({defaultMessage: 'All the playbooks that you can access will show here'})}
                    right={(
                        <TitleActions>
                            {canCreatePlaybooks && (
                                <>
                                    <ImportButton
                                        onClick={handleImportClick}
                                    />
                                    {inputImportPlaybook}
                                    <HorizontalSpacer size={12}/>
                                    <PlaybookModalButton/>
                                </>
                            )}
                        </TitleActions>
                    )}
                    css={`
                        border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
                    `}
                />
                <PlaybooksListFilters>
                    <SearchInput
                        testId={'search-filter'}
                        default={params.search_term}
                        onSearch={setSearchTerm}
                        placeholder={formatMessage({defaultMessage: 'Search for a playbook'})}
                    />
                    <HorizontalSpacer size={12}/>
                    <CheckboxInput
                        testId={'with-archived'}
                        text={formatMessage({defaultMessage: 'With archived'})}
                        checked={params.with_archived}
                        onChange={setWithArchived}
                    />
                    <HorizontalSpacer size={12}/>
                </PlaybooksListFilters>
                <BackstageListHeader $edgeless={true}>
                    <div className='row'>
                        <div className='col-sm-4'>
                            <SortableColHeader
                                name={formatMessage({defaultMessage: 'Name'})}
                                direction={params.direction}
                                active={params.sort === 'title'}
                                onClick={() => sortBy('title')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={formatMessage({defaultMessage: 'Last used'})}
                                direction={params.direction}
                                active={params.sort === 'last_run_at'}
                                onClick={() => sortBy('last_run_at')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={formatMessage({defaultMessage: 'Active Runs'})}
                                direction={params.direction}
                                active={params.sort === 'active_runs'}
                                onClick={() => sortBy('active_runs')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <SortableColHeader
                                name={formatMessage({defaultMessage: 'Runs'})}
                                direction={params.direction}
                                active={params.sort === 'runs'}
                                onClick={() => sortBy('runs')}
                            />
                        </div>
                        <div className='col-sm-2'>
                            <FormattedMessage defaultMessage='Actions'/>
                        </div>
                    </div>
                </BackstageListHeader>
                {listBody}
                <PaginationRow
                    page={params.page}
                    perPage={params.per_page}
                    totalCount={totalCount}
                    setPage={setPage}
                />
            </TableContainer>
        );
    };

    // If we don't have a bottomHalf, create it. Or if we're loading new playbooks, use the previous body.
    if (!content.current || !isLoading) {
        content.current = makePlaybookList();
    }

    return (
        <PlaybookListContainer>
            <FileUploadOverlay
                show={isDraggingFile}
                message={formatMessage({
                    defaultMessage: 'Drop a playbook export file to import it.',
                })}
                overlayType='center'
            />
            <ScrollContainer
                onDragEnter={handleImportDragEnter}
                onDragOver={handleImportDragOver}
                onDrop={handleImportDrop}
                data-testid='playbook-list-scroll-container'
            >
                {content.current}
                {canCreatePlaybooks && (
                    <>
                        <ContainerMedium
                            ref={selectorRef}
                        >
                            {props.firstTimeUserExperience || (!hasPlaybooks && !isFiltering) ? (
                                <AltCreatePlaybookHeader>
                                    <AltHeading>
                                        {formatMessage({defaultMessage: 'Choose a template'})}
                                    </AltHeading>
                                    <ImportSub>
                                        {formatMessage<ReactNode>({defaultMessage: 'or <ImportPlaybookButton>Import a playbook</ImportPlaybookButton>'}, {
                                            ImportPlaybookButton: (chunks) => (
                                                <ImportLinkButton
                                                    onClick={handleImportClick}
                                                >
                                                    {chunks}
                                                </ImportLinkButton>
                                            ),
                                        })}
                                    </ImportSub>
                                    <AltSub>
                                        {formatMessage({defaultMessage: 'There are templates for a range of use cases and events. You can use a playbook as-is or customize it—then share it with your team.'})}
                                    </AltSub>
                                </AltCreatePlaybookHeader>
                            ) : (
                                <CreatePlaybookHeader>
                                    <Heading>
                                        {formatMessage({defaultMessage: 'Do more with Playbooks'})}
                                    </Heading>
                                    <Sub>
                                        {formatMessage({defaultMessage: 'There are templates for a range of use cases and events. You can use a playbook as-is or customize it—then share it with your team.'})}
                                    </Sub>
                                </CreatePlaybookHeader>
                            )}
                            <TemplateSelector
                                templates={props.firstTimeUserExperience || (!hasPlaybooks && !isFiltering) ? swapEnds(PresetTemplates) : PresetTemplates}
                            />
                        </ContainerMedium>
                    </>
                )}
                {confirmArchiveModal}
                {confirmRestoreModal}
            </ScrollContainer>
        </PlaybookListContainer>
    );
};

function swapEnds(arr: Array<any>) {
    return [arr[arr.length - 1], ...arr.slice(1, -1), arr[0]];
}

interface ImportButtonProps {
    onClick?: () => void;
}

const ImportButton = (props: ImportButtonProps) => {
    return (
        <TertiaryButton {...props}>
            <FormattedMessage defaultMessage='Import'/>
        </TertiaryButton>
    );
};

const ImportLinkButton = (props: PropsWithChildren<ImportButtonProps>) => {
    return (
        <ImportLink {...props}/>
    );
};

const PlaybookModalButton = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    return (
        <CreatePlaybookButton
            onClick={() => dispatch(displayPlaybookCreateModal({}))}
        >
            <i className='icon-plus mr-2'/>
            {formatMessage({defaultMessage: 'Create playbook'})}
        </CreatePlaybookButton>
    );
};

const CreatePlaybookButton = styled(PrimaryButton)`
    display: flex;
    align-items: center;
`;
export default PlaybookList;
