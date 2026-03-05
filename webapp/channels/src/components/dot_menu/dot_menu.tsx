    ~/codebase/go/src/github.com/mattermost/enterprise    master  mm                                                                                                                                                                         ✔  8s 

    ~/codebase/go/src/github.com/mattermost/mattermost/server    secure_urls *3 ?5  ../webapp                                                                                                                                                       ✔

    ~/codebase/go/src/github.com/mattermost/mattermost/webapp    secure_urls *3 ?5  nvm use                                                                                                                                                         ✔
Found '/Users/harshilsharma/codebase/go/src/github.com/mattermost/mattermost/.nvmrc' with version <24.11>
Now using node v24.11.1 (npm v11.6.2)

    ~/codebase/go/src/github.com/mattermost/mattermost/webapp    secure_urls *3 ?5  npm run fix && npm run check && npm run check-types && npm run i18n-extract                                                                                     ✔

> fix
> npm run fix --workspaces --if-present


> mattermost-webapp@11.4.0 fix
> eslint --ext .js,.jsx,.tsx,.ts ./src --quiet --fix --cache && stylelint "**/*.{css,scss}" --fix --cache

=============

WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

You may find that it works just fine, or you may not.

SUPPORTED TYPESCRIPT VERSIONS: >=4.7.4 <5.6.0

YOUR TYPESCRIPT VERSION: 5.6.3

Please only submit bug reports when using the officially supported version.

=============

> @mattermost/shared@11.4.0 fix
> eslint --ext .js,.jsx,.tsx,.ts ./src --quiet --fix && stylelint "**/*.{css,scss}" --fix

=============

WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

You may find that it works just fine, or you may not.

SUPPORTED TYPESCRIPT VERSIONS: >=4.7.4 <5.6.0

YOUR TYPESCRIPT VERSION: 5.6.3

Please only submit bug reports when using the officially supported version.

=============

> check
> npm run check --workspaces --if-present


> mattermost-webapp@11.4.0 check
> npm run check:eslint && npm run check:stylelint


> mattermost-webapp@11.4.0 check:eslint
> eslint --ext .js,.jsx,.tsx,.ts ./src --quiet --cache

=============

WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

You may find that it works just fine, or you may not.

SUPPORTED TYPESCRIPT VERSIONS: >=4.7.4 <5.6.0

YOUR TYPESCRIPT VERSION: 5.6.3

Please only submit bug reports when using the officially supported version.

=============

> mattermost-webapp@11.4.0 check:stylelint
> stylelint "**/*.{css,scss}" --cache


> @mattermost/client@11.4.0 check
> eslint --ext .js,.jsx,.tsx,.ts ./src --quiet

=============

WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

You may find that it works just fine, or you may not.

SUPPORTED TYPESCRIPT VERSIONS: >=4.7.4 <5.6.0

YOUR TYPESCRIPT VERSION: 5.6.3

Please only submit bug reports when using the officially supported version.

=============

> @mattermost/components@9.2.0 check
> eslint --ext .js,.jsx,.tsx,.ts ./src --quiet

=============

WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

You may find that it works just fine, or you may not.

SUPPORTED TYPESCRIPT VERSIONS: >=4.7.4 <5.6.0

YOUR TYPESCRIPT VERSION: 5.6.3

Please only submit bug reports when using the officially supported version.

=============

> @mattermost/shared@11.4.0 check
> npm run check:eslint && npm run check:stylelint


> @mattermost/shared@11.4.0 check:eslint
> eslint --ext .js,.jsx,.tsx,.ts ./src --quiet

=============

WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

You may find that it works just fine, or you may not.

SUPPORTED TYPESCRIPT VERSIONS: >=4.7.4 <5.6.0

YOUR TYPESCRIPT VERSION: 5.6.3

Please only submit bug reports when using the officially supported version.

=============

> @mattermost/shared@11.4.0 check:stylelint
> stylelint "**/*.{css,scss}"


> @mattermost/types@11.4.0 check
> eslint --ext .js,.jsx,.tsx,.ts ./src --quiet

=============

WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

You may find that it works just fine, or you may not.

SUPPORTED TYPESCRIPT VERSIONS: >=4.7.4 <5.6.0

YOUR TYPESCRIPT VERSION: 5.6.3

Please only submit bug reports when using the officially supported version.

=============

> check-types
> npm run check-types --workspaces --if-present


> mattermost-webapp@11.4.0 check-types
> tsc -b

src/components/dot_menu/index.ts:167:65 - error TS2345: Argument of type 'FC<WithIntlProps<Props>> & { WrappedComponent: ComponentType<Props>; }' is not assignable to parameter of type 'ComponentType<Matching<{ channelIsArchived: boolean; components: { CallButton: CallButtonAction[]; PostDropdownMenu: PostDropdownMenuAction[]; MainMenu: MainMenuAction[]; ... 41 more ...; SystemConsoleGroupTable: SystemConsoleGroupTableComponent[]; }; ... 23 more ...; isUnrevealedBurnOnReadPost: boolean; } & { ...; ...'.
  Type 'FC<WithIntlProps<Props>> & { WrappedComponent: ComponentType<Props>; }' is not assignable to type 'FunctionComponent<Matching<{ channelIsArchived: boolean; components: { CallButton: CallButtonAction[]; PostDropdownMenu: PostDropdownMenuAction[]; MainMenu: MainMenuAction[]; ... 41 more ...; SystemConsoleGroupTable: SystemConsoleGroupTableComponent[]; }; ... 23 more ...; isUnrevealedBurnOnReadPost: boolean; } & { ....'.
    Types of property 'propTypes' are incompatible.
      Type 'WeakValidationMap<WithIntlProps<Props>> | undefined' is not assignable to type 'WeakValidationMap<Matching<{ channelIsArchived: boolean; components: { CallButton: CallButtonAction[]; PostDropdownMenu: PostDropdownMenuAction[]; MainMenu: MainMenuAction[]; ... 41 more ...; SystemConsoleGroupTable: SystemConsoleGroupTableComponent[]; }; ... 23 more ...; isUnrevealedBurnOnReadPost: boolean; } & { ....'.
        Type 'WeakValidationMap<WithIntlProps<Props>>' is not assignable to type 'WeakValidationMap<Matching<{ channelIsArchived: boolean; components: { CallButton: CallButtonAction[]; PostDropdownMenu: PostDropdownMenuAction[]; MainMenu: MainMenuAction[]; ... 41 more ...; SystemConsoleGroupTable: SystemConsoleGroupTableComponent[]; }; ... 23 more ...; isUnrevealedBurnOnReadPost: boolean; } & { ....'.
          Types of property 'actions' are incompatible.
            Type 'Validator<{ flagPost: (postId: string) => Promise<ActionResult>; unflagPost: (postId: string) => Promise<ActionResult>; setEditingPost: (postId?: string | undefined, refocusId?: string | undefined, isRHS?: boolean | undefined) => Promise<...>; ... 7 more ...; savePreferences: (userId: string, preferences: { ...; }[]...' is not assignable to type 'Validator<{ flagPost: (postId: string) => Promise<ActionResult<unknown, any>>; unflagPost: (postId: string) => Promise<ActionResult<unknown, any>>; ... 8 more ...; savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<...>; }> | undefined'.
              Type 'Validator<{ flagPost: (postId: string) => Promise<ActionResult>; unflagPost: (postId: string) => Promise<ActionResult>; setEditingPost: (postId?: string | undefined, refocusId?: string | undefined, isRHS?: boolean | undefined) => Promise<...>; ... 7 more ...; savePreferences: (userId: string, preferences: { ...; }[]...' is not assignable to type 'Validator<{ flagPost: (postId: string) => Promise<ActionResult<unknown, any>>; unflagPost: (postId: string) => Promise<ActionResult<unknown, any>>; setEditingPost: (postId?: string | undefined, refocusId?: string | undefined, isRHS?: boolean | undefined) => ActionResult<...>; ... 7 more ...; savePreferences: (userId...'.
                Type '{ flagPost: (postId: string) => Promise<ActionResult>; unflagPost: (postId: string) => Promise<ActionResult>; setEditingPost: (postId?: string | undefined, refocusId?: string | undefined, isRHS?: boolean | undefined) => Promise<...>; ... 7 more ...; savePreferences: (userId: string, preferences: { ...; }[]) => void; }' is not assignable to type '{ flagPost: (postId: string) => Promise<ActionResult<unknown, any>>; unflagPost: (postId: string) => Promise<ActionResult<unknown, any>>; setEditingPost: (postId?: string | undefined, refocusId?: string | undefined, isRHS?: boolean | undefined) => ActionResult<...>; ... 7 more ...; savePreferences: (userId: string, ...'.
                  The types returned by 'setEditingPost(...)' are incompatible between these types.
                    Type 'Promise<ActionResult>' has no properties in common with type 'ActionResult<boolean, any>'.

167 export default connect(makeMapStateToProps, mapDispatchToProps)(DotMenu);
                                                                    ~~~~~~~


Found 1 error.

npm error Lifecycle script `check-types` failed with error:
npm error code 2
npm error path /Users/harshilsharma/codebase/go/src/github.com/mattermost/mattermost/webapp/channels
npm error workspace mattermost-webapp@11.4.0
npm error location /Users/harshilsharma/codebase/go/src/github.com/mattermost/mattermost/webapp/channels
npm error command failed
npm error command sh -c tsc -b


> @mattermost/components@9.2.0 check-types
> tsc -b


> @mattermost/shared@11.4.0 check-types
> tsc -b


    ~/codebase/go/src/github.com/mattermost/mattermost/webapp    secure_urls *3 !1 ?5                                                                                                                                                   2 ✘  2m 0s 