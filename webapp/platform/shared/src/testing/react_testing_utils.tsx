// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, renderHook} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import {useMockSharedContext} from './useMockSharedContext';

import type {SharedProviderProps} from '../context';

export type FullContextOptions = {
    intlMessages?: Record<string, string>;
    locale?: string;
    sharedContext?: Partial<Omit<SharedProviderProps, 'children'>>;
}

export const renderWithContext = (
    component: React.ReactElement,

    partialOptions?: FullContextOptions,
) => {
    const options = {
        intlMessages: partialOptions?.intlMessages,
        locale: partialOptions?.locale ?? 'en',
        sharedContext: partialOptions?.sharedContext,
    };

    // Store these in an object so that they can be maintained through rerenders
    const renderState = {
        component,

        options,
    };

    const results = render(component, {
        wrapper: ({children}) => {
            // Every time this is called, these values should be updated from `renderState`
            return <Providers {...renderState}>{children}</Providers>;
        },
    });

    return {
        ...results,
        rerender: (newComponent: React.ReactElement) => {
            renderState.component = newComponent;

            results.rerender(renderState.component);
        },
    };
};

export const renderHookWithContext = <TProps, TResult>(
    callback: (props: TProps) => TResult,

    partialOptions?: FullContextOptions,
) => {
    const options = {
        intlMessages: partialOptions?.intlMessages,
        locale: partialOptions?.locale ?? 'en',
        sharedContext: partialOptions?.sharedContext,
    };

    // Store these in an object so that they can be maintained through rerenders
    const renderState = {
        callback,
        options,
    };

    const results = renderHook(callback, {
        wrapper: ({children}) => {
            // Every time this is called, these values should be updated from `renderState`
            return <Providers {...renderState}>{children}</Providers>;
        },
    });

    return {
        ...results,
    };
};

type Opts = {
    intlMessages: Record<string, string> | undefined;
    locale: string;
    sharedContext?: Partial<Omit<SharedProviderProps, 'children'>>;
}

type RenderStateProps = {
    children: React.ReactNode;

    options: Opts;
}

// This should wrap the component in roughly the same providers used in App and RootProvider
const Providers = ({
    children,

    options,
}: RenderStateProps) => {
    const {SharedContextProvider} = useMockSharedContext(options?.sharedContext ?? {});

    return (
        <SharedContextProvider>
            <IntlProvider
                locale={options.locale}
                messages={options.intlMessages}
            >
                {children}
            </IntlProvider>
        </SharedContextProvider>
    );
};
