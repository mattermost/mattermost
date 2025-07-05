// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {JobStatus} from '@mattermost/types/jobs';

import JobsTable from 'components/admin_console/jobs';
import SettingSet from 'components/admin_console/setting_set';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {JobStatuses, JobTypes} from 'utils/constants';

import BulkIndexing from './bulk_indexing';

jest.mock('components/admin_console/jobs', () => ({
    __esModule: true,
    default: jest.fn(),
}));
const mockGetJobStatus = jest.fn<JobStatus, []>(() => JobStatuses.IN_PROGRESS);
let extraInfoText: React.ReactNode | undefined;
jest.mocked(JobsTable).mockImplementation((props) => {
    return (
        <div data-testid='jobs-table'>
            <button
                data-testid='create-job-button'
                disabled={props.disabled}
            >
                {props.createJobButtonText}
            </button>
            <div data-testid='create-job-help'>{props.createJobHelpText}</div>
            <div data-testid='job-type'>{props.jobType}</div>
            <button
                data-testid='extra-info-text'
                onClick={() => {
                    extraInfoText = props.getExtraInfoText?.({
                        type: JobTypes.BLEVE_POST_INDEXING,
                        id: '1',
                        priority: 1,
                        create_at: 1,
                        start_at: 1,
                        last_activity_at: 1,
                        status: mockGetJobStatus(),
                        progress: 50,
                        data: {},
                    });
                }}
            />
        </div>
    );
});

jest.mock('components/admin_console/setting_set', () => ({
    __esModule: true,
    default: jest.fn(),
}));
jest.mocked(SettingSet).mockImplementation((props) => {
    return (
        <div data-testid='setting-set'>
            <div data-testid='setting-set-label'>{props.label}</div>
            {props.children}
        </div>
    );
});

describe('BulkIndexing', () => {
    const defaultProps = {
        canPurgeAndIndex: true,
        isDisabled: false,
    };

    beforeEach(() => {
        extraInfoText = undefined;
    });

    it('should render the component with correct title', () => {
        renderWithContext(<BulkIndexing {...defaultProps}/>);

        expect(screen.getByText('Bulk Indexing:')).toBeInTheDocument();
    });

    it('should render JobsTable with correct props when canPurgeAndIndex is true', () => {
        renderWithContext(<BulkIndexing {...defaultProps}/>);

        expect(screen.getByTestId('jobs-table')).toBeInTheDocument();
        expect(screen.getByTestId('create-job-button')).not.toBeDisabled();
        expect(screen.getByText('Index Now')).toBeInTheDocument();
        expect(screen.getByTestId('job-type')).toHaveTextContent(JobTypes.BLEVE_POST_INDEXING);
    });

    it('should get extra info text when button is clicked and job is in', () => {
        mockGetJobStatus.mockReturnValue(JobStatuses.IN_PROGRESS);
        renderWithContext(<BulkIndexing {...defaultProps}/>);
        const button = screen.getByTestId('extra-info-text');
        button.click();
        expect(extraInfoText).toBeDefined();

        renderWithContext(<>{extraInfoText}</>);
        expect(screen.getByText('50% Complete')).toBeInTheDocument();
    });

    it('should not get extra info text when button is clicked and job is not in progress', () => {
        mockGetJobStatus.mockReturnValue(JobStatuses.SUCCESS);
        renderWithContext(<BulkIndexing {...defaultProps}/>);
        const button = screen.getByTestId('extra-info-text');
        button.click();
        expect(extraInfoText).toBeDefined();

        renderWithContext(<>{extraInfoText}</>);
        expect(screen.queryByText('50% Complete')).not.toBeInTheDocument();
    });

    it('should disable JobsTable when canPurgeAndIndex is false', () => {
        renderWithContext(
            <BulkIndexing
                {...defaultProps}
                canPurgeAndIndex={false}
            />,
        );

        expect(screen.getByTestId('create-job-button')).toBeDisabled();
    });

    it('should disable JobsTable when isDisabled is true', () => {
        renderWithContext(
            <BulkIndexing
                {...defaultProps}
                isDisabled={true}
            />,
        );

        expect(screen.getByTestId('create-job-button')).toBeDisabled();
    });

    it('should disable JobsTable when both canPurgeAndIndex is false and isDisabled is true', () => {
        renderWithContext(
            <BulkIndexing
                {...defaultProps}
                canPurgeAndIndex={false}
                isDisabled={true}
            />,
        );

        expect(screen.getByTestId('create-job-button')).toBeDisabled();
    });

    it('should render help text for create job', () => {
        renderWithContext(<BulkIndexing {...defaultProps}/>);

        expect(screen.getByText(/All users, channels and posts in the database will be indexed/)).toBeInTheDocument();
    });

    it('should render SettingSet wrapper', () => {
        renderWithContext(<BulkIndexing {...defaultProps}/>);

        expect(screen.getByTestId('setting-set')).toBeInTheDocument();
        expect(screen.getByTestId('setting-set-label')).toBeInTheDocument();
    });

    it('should render job table setting container', () => {
        renderWithContext(<BulkIndexing {...defaultProps}/>);

        const container = screen.getByTestId('jobs-table').closest('.job-table-setting');
        expect(container).toBeInTheDocument();
    });
});
