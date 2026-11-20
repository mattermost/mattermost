// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The runtime of the generated page objects (src/ui/generated): bindings, one driver per ARIA pattern, the Scope base
// class, pages, the operations catalog, `settle` and `waitForApi`, i18n messages and retrying matchers.

export {
    CATALOG,
    apiOp,
    canonicalPattern,
    defineApi,
    SEEN_LIMIT,
    describeQuery,
    describeSeen,
    isCandidate,
    isRequestFor,
    matchesQuery,
    operationOf,
    type AnyApiOp,
    type ApiOp,
    type BodyOf,
    type HttpMethod,
    type PathParamsOf,
    type PlaceholdersOf,
    type QueryFilter,
} from './api';
export {RUNTIME_API, type RuntimeApiCheck} from './api_version';
export type {Keyed, KeyOf, Meta, NotRendered, Part, PartBinding} from './bindings';
export {DestinationError, type ToOptions} from './destinations';
export {
    ButtonDriver,
    CheckboxDriver,
    ClickableDriver,
    ComboboxDriver,
    ContainerDriver,
    Driver,
    FileInputDriver,
    LinkDriver,
    MenuitemCheckDriver,
    MenuitemDriver,
    OptionDriver,
    RadioDriver,
    RadiogroupDriver,
    SwitchDriver,
    TabDriver,
    TextboxDriver,
    TextDriver,
    TogglebuttonDriver,
    driverFor,
    elementLine,
    withElement,
    type AnyDriver,
    type ClickOptions,
    type Destination,
    type RootedScope,
    type DriverFor,
    type ElementInfo,
    type RoleDrivers,
} from './drivers';
export {ROLES, keyOfTestId, keyedPattern, parseTestId, type Role} from './grammar';
export {
    expect,
    type AriaMatchers,
    type ElementAssertions,
    type ListAssertions,
    type MessageMatchers,
    type SurfaceExpect,
} from './matchers';
export {formatMessage, msg, type Message, type ParamsOf as MessageParamsOf} from './msg';
export {SurfacePage, buildPath, type ParamsOf, type ReadyPage} from './pages';
export {pluginSurfaces, registerPluginSurface, type Plugins} from './plugins';
export {
    KeyedList,
    NOT_RENDERED,
    Scope,
    keyOf,
    keyOfElement,
    testIdSelector,
    type ContentFilter,
    type ListOptions,
    type MemberOptions,
} from './scope';
export {
    SettleError,
    describeElement,
    settle,
    waitForApi,
    type ApiWaitOptions,
    type SettleOptions,
    type Settling,
} from './settle';
export {OBSERVING_VERBS, PREPARING_VERBS, RETRYING_MATCHERS, VERBS, type SettleVerb, type Verb} from './verbs';
