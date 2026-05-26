/**
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook } from '@testing-library/react';
import {
  DataProviderOverridesProvider,
  useDataProviderOverrides,
  type DataProviderOverrides,
} from '../src/react-query/data-provider-overrides';

const wrapWith = (overrides: DataProviderOverrides | null) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      DataProviderOverridesProvider,
      { value: overrides },
      children,
    );
  };

describe('useDataProviderOverrides', () => {
  test('returns null when no provider is mounted', () => {
    const { result } = renderHook(() => useDataProviderOverrides());
    expect(result.current).toBeNull();
  });

  test('returns the registered overrides when provider IS mounted', () => {
    const overrides: DataProviderOverrides = {
      useConversationsInfiniteQuery: jest.fn(),
      useGetMessagesByConvoId: jest.fn(),
      useGetConvoIdQuery: jest.fn(),
      useUpdateConversationMutation: jest.fn(),
      useDeleteConversationMutation: jest.fn(),
    };

    const { result } = renderHook(() => useDataProviderOverrides(), {
      wrapper: wrapWith(overrides),
    });

    expect(result.current).toBe(overrides);
    expect(result.current?.useConversationsInfiniteQuery).toBe(
      overrides.useConversationsInfiniteQuery,
    );
    expect(result.current?.useGetMessagesByConvoId).toBe(overrides.useGetMessagesByConvoId);
    expect(result.current?.useGetConvoIdQuery).toBe(overrides.useGetConvoIdQuery);
    expect(result.current?.useUpdateConversationMutation).toBe(
      overrides.useUpdateConversationMutation,
    );
    expect(result.current?.useDeleteConversationMutation).toBe(
      overrides.useDeleteConversationMutation,
    );
  });

  test('supports partial overrides (only some hooks defined)', () => {
    const overrides: DataProviderOverrides = {
      useGetMessagesByConvoId: jest.fn(),
    };

    const { result } = renderHook(() => useDataProviderOverrides(), {
      wrapper: wrapWith(overrides),
    });

    expect(result.current).toBe(overrides);
    expect(result.current?.useGetMessagesByConvoId).toBe(overrides.useGetMessagesByConvoId);
    expect(result.current?.useConversationsInfiniteQuery).toBeUndefined();
  });
});
