import React, { createContext, useContext } from 'react';

/**
 * Optional per-hook override map. Each property substitutes the matching
 * hook from `client/src/data-provider`. When a hook is `undefined`, the
 * default upstream implementation runs unchanged.
 *
 * Hooks are typed as `unknown` here to avoid coupling this barrel to the
 * upstream hook signatures — consumers are responsible for matching the
 * call signature and return shape of the hook they replace. This keeps the
 * override context upstream-rebaseable: when LibreChat changes a hook's
 * return type, only the consumer's override needs to track the change, not
 * this type declaration.
 */
export type DataProviderOverrides = {
  useConversationsInfiniteQuery?: unknown;
  useGetMessagesByConvoId?: unknown;
  useGetConvoIdQuery?: unknown;
  useUpdateConversationMutation?: unknown;
  useDeleteConversationMutation?: unknown;
};

const DataProviderOverridesContext = createContext<DataProviderOverrides | null>(null);
DataProviderOverridesContext.displayName = 'DataProviderOverridesContext';

export type DataProviderOverridesProviderProps = {
  value: DataProviderOverrides | null;
  children?: React.ReactNode;
};

/**
 * Provider for `useDataProviderOverrides`. Wrap any subtree that should
 * dispatch SDK-backed conversation hooks instead of the default
 * react-query implementations. Subtrees not wrapped (or wrapped with
 * `value={null}`) get the default upstream behavior.
 */
export function DataProviderOverridesProvider({
  value,
  children,
}: DataProviderOverridesProviderProps) {
  return React.createElement(
    DataProviderOverridesContext.Provider,
    { value },
    children,
  );
}

/**
 * Returns the active override map, or `null` when no provider is mounted.
 * The hook itself is always called (rules of hooks); the conditional
 * dispatch on the returned value happens at each call site.
 */
export function useDataProviderOverrides(): DataProviderOverrides | null {
  return useContext(DataProviderOverridesContext);
}
