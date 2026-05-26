import userEvent from '@testing-library/user-event';
import { render, waitFor } from 'test/layout-test-utils';
import * as mockDataProvider from 'librechat-data-provider/react-query';
import type { TStartupConfig } from 'librechat-data-provider';
import * as miscDataProvider from '~/data-provider/Misc/queries';
import * as endpointQueries from '~/data-provider/Endpoints/queries';
import * as authMutations from '~/data-provider/Auth/mutations';
import * as authQueries from '~/data-provider/Auth/queries';
import Registration from '~/components/Auth/Registration';
import AuthLayout from '~/components/Auth/AuthLayout';

jest.mock('librechat-data-provider/react-query');

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useOutletContext: () => ({
    startupConfig: {
      socialLogins: [],
      registrationEnabled: true,
      socialLoginEnabled: false,
      emailEnabled: true,
      emailLoginEnabled: true,
      serverDomain: 'mock-server',
    },
  }),
}));

type RegisterMutation = {
  mutate: jest.Mock;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  data: Record<string, unknown>;
  error: Error | null;
};

const buildMutation = (overrides: Partial<RegisterMutation> = {}): RegisterMutation => ({
  mutate: jest.fn(),
  isLoading: false,
  isError: false,
  isSuccess: false,
  data: {},
  error: null,
  ...overrides,
});

type SetupOpts = {
  defaultMutation?: RegisterMutation;
  registerOverride?: RegisterMutation;
  onSuccess?: (data: unknown) => void;
};

const baseStartupConfig = {
  socialLogins: [] as string[],
  registrationEnabled: true,
  socialLoginEnabled: false,
  emailEnabled: true,
  emailLoginEnabled: true,
  serverDomain: 'mock-server',
};

const setup = ({ defaultMutation, registerOverride, onSuccess }: SetupOpts = {}) => {
  const mutation = defaultMutation ?? buildMutation();

  jest
    .spyOn(mockDataProvider, 'useRegisterUserMutation')
    // @ts-ignore - partial mock
    .mockReturnValue(mutation);
  jest
    .spyOn(authQueries, 'useGetUserQuery')
    // @ts-ignore - partial mock
    .mockReturnValue({ isLoading: false, isError: false, data: {} });
  jest
    .spyOn(endpointQueries, 'useGetStartupConfig')
    // @ts-ignore - partial mock
    .mockReturnValue({
      isFetching: false,
      isLoading: false,
      isError: false,
      data: baseStartupConfig,
    });
  jest
    .spyOn(authMutations, 'useRefreshTokenMutation')
    // @ts-ignore - partial mock
    .mockReturnValue({
      isLoading: false,
      isError: false,
      mutate: jest.fn(),
      data: { token: 'mock-token', user: {} },
    });
  jest
    .spyOn(miscDataProvider, 'useGetBannerQuery')
    // @ts-ignore - partial mock
    .mockReturnValue({ isLoading: false, isError: false, data: {} });

  const renderResult = render(
    <AuthLayout
      startupConfig={baseStartupConfig as unknown as TStartupConfig}
      isFetching={false}
      error={null}
      startupConfigError={null}
      header="Create your account"
      pathname="register"
    >
      <Registration registerOverride={registerOverride} onSuccess={onSuccess} />
    </AuthLayout>,
  );

  return { ...renderResult, mutation };
};

const fillAndSubmit = async (
  getByRole: (...args: unknown[]) => HTMLElement,
  getByTestId: (id: string) => HTMLElement,
) => {
  await userEvent.type(
    getByRole('textbox', { name: /Full name/i } as unknown as object) as HTMLElement,
    'John Doe',
  );
  await userEvent.type(
    getByRole('textbox', { name: /Username/i } as unknown as object) as HTMLElement,
    'johndoe',
  );
  await userEvent.type(
    getByRole('textbox', { name: /Email/i } as unknown as object) as HTMLElement,
    'test@test.com',
  );
  await userEvent.type(getByTestId('password'), 'password');
  await userEvent.type(getByTestId('confirm_password'), 'password');
  await userEvent.click(
    getByRole('button', { name: /Submit registration/i } as unknown as object) as HTMLElement,
  );
};

describe('Registration factoryification — registerOverride + onSuccess', () => {
  test('uses default useRegisterUserMutation when no override is provided', async () => {
    const defaultMutation = buildMutation();
    const { getByRole, getByTestId } = setup({ defaultMutation });

    await fillAndSubmit(
      getByRole as unknown as (...args: unknown[]) => HTMLElement,
      getByTestId as unknown as (id: string) => HTMLElement,
    );

    await waitFor(() => expect(defaultMutation.mutate).toHaveBeenCalledTimes(1));
    expect(defaultMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Doe',
        username: 'johndoe',
        email: 'test@test.com',
        password: 'password',
        confirm_password: 'password',
      }),
    );
  });

  test('dispatches registerOverride.mutate instead of default when override is provided', async () => {
    const defaultMutation = buildMutation();
    const overrideMutation = buildMutation();
    const { getByRole, getByTestId } = setup({
      defaultMutation,
      registerOverride: overrideMutation,
    });

    await fillAndSubmit(
      getByRole as unknown as (...args: unknown[]) => HTMLElement,
      getByTestId as unknown as (id: string) => HTMLElement,
    );

    await waitFor(() => expect(overrideMutation.mutate).toHaveBeenCalledTimes(1));
    expect(overrideMutation.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'John Doe',
        username: 'johndoe',
        email: 'test@test.com',
        password: 'password',
        confirm_password: 'password',
      }),
    );
    expect(defaultMutation.mutate).not.toHaveBeenCalled();
  });

  test('invokes onSuccess callback when override mutation reports isSuccess=true', async () => {
    const onSuccess = jest.fn();
    const successData = { user_id: 'oxia-user-42' };
    const overrideMutation = buildMutation({ isSuccess: true, data: successData });
    setup({ registerOverride: overrideMutation, onSuccess });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).toHaveBeenCalledWith(successData);
  });
});
