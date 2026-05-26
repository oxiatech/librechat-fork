import userEvent from '@testing-library/user-event';
import { getByTestId, render, waitFor } from 'test/layout-test-utils';
import type { TStartupConfig, TLoginUser } from 'librechat-data-provider';
import * as endpointQueries from '~/data-provider/Endpoints/queries';
import * as miscDataProvider from '~/data-provider/Misc/queries';
import * as authMutations from '~/data-provider/Auth/mutations';
import * as authQueries from '~/data-provider/Auth/queries';
import * as authContextHook from '~/hooks/AuthContext';
import AuthLayout from '~/components/Auth/AuthLayout';
import Login from '~/components/Auth/Login';

jest.mock('librechat-data-provider/react-query');

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useOutletContext: () => ({
    startupConfig: {
      socialLogins: [],
      discordLoginEnabled: false,
      facebookLoginEnabled: false,
      githubLoginEnabled: false,
      googleLoginEnabled: false,
      openidLoginEnabled: false,
      openidLabel: '',
      openidImageUrl: '',
      samlLoginEnabled: false,
      samlLabel: '',
      samlImageUrl: '',
      ldap: { enabled: false },
      registrationEnabled: true,
      emailLoginEnabled: true,
      socialLoginEnabled: false,
      serverDomain: 'mock-server',
    },
  }),
}));

const mockStartupConfig = {
  isFetching: false,
  isLoading: false,
  isError: false,
  data: {
    socialLogins: [] as string[],
    discordLoginEnabled: false,
    facebookLoginEnabled: false,
    githubLoginEnabled: false,
    googleLoginEnabled: false,
    openidLoginEnabled: false,
    openidLabel: '',
    openidImageUrl: '',
    samlLoginEnabled: false,
    samlLabel: '',
    samlImageUrl: '',
    ldap: { enabled: false },
    registrationEnabled: true,
    emailLoginEnabled: true,
    socialLoginEnabled: false,
    serverDomain: 'mock-server',
  },
};

type SetupOpts = {
  loginOverride?: (data: TLoginUser) => void;
  defaultLogin?: jest.Mock;
};

const setup = ({ loginOverride, defaultLogin }: SetupOpts = {}) => {
  jest.spyOn(authMutations, 'useLoginUserMutation').mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
    data: {},
    isSuccess: false,
    // @ts-ignore - partial mock
  });
  jest.spyOn(authQueries, 'useGetUserQuery').mockReturnValue({
    isLoading: false,
    isError: false,
    data: {},
    // @ts-ignore - partial mock
  });
  jest.spyOn(endpointQueries, 'useGetStartupConfig').mockReturnValue(
    // @ts-ignore - partial mock
    mockStartupConfig,
  );
  jest.spyOn(authMutations, 'useRefreshTokenMutation').mockReturnValue({
    isLoading: false,
    isError: false,
    mutate: jest.fn(),
    data: { token: 'mock-token', user: {} },
    // @ts-ignore - partial mock
  });
  jest.spyOn(miscDataProvider, 'useGetBannerQuery').mockReturnValue({
    isLoading: false,
    isError: false,
    data: {},
    // @ts-ignore - partial mock
  });
  const login = defaultLogin ?? jest.fn();
  jest.spyOn(authContextHook, 'useAuthContext').mockReturnValue({
    // @ts-ignore - partial AuthContext mock
    error: null,
    setError: jest.fn(),
    login,
    token: null,
    isAuthenticated: false,
    user: undefined,
    logout: jest.fn(),
  });

  const renderResult = render(
    <AuthLayout
      startupConfig={mockStartupConfig.data as TStartupConfig}
      isFetching={mockStartupConfig.isFetching}
      error={null}
      startupConfigError={null}
      header="Welcome back"
      pathname="login"
    >
      <Login loginOverride={loginOverride} />
    </AuthLayout>,
  );

  return { ...renderResult, login };
};

const submit = async (getByLabelText: (m: RegExp) => HTMLElement) => {
  const emailInput = getByLabelText(/email/i);
  const passwordInput = getByLabelText(/password/i);
  const submitButton = getByTestId(document.body, 'login-button');

  await userEvent.type(emailInput, 'override-test@example.com');
  await userEvent.type(passwordInput, 'pw1234567');
  await userEvent.click(submitButton);
};

describe('Login factoryification — loginOverride prop', () => {
  test('uses AuthContext.login when no loginOverride prop is provided', async () => {
    const defaultLogin = jest.fn();
    const { getByLabelText } = setup({ defaultLogin });

    await submit(getByLabelText as (m: RegExp) => HTMLElement);

    await waitFor(() => expect(defaultLogin).toHaveBeenCalledTimes(1));
    expect(defaultLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'override-test@example.com',
        password: 'pw1234567',
      }),
    );
  });

  test('uses loginOverride instead of AuthContext.login when override is provided', async () => {
    const defaultLogin = jest.fn();
    const loginOverride = jest.fn();
    const { getByLabelText } = setup({ defaultLogin, loginOverride });

    await submit(getByLabelText as (m: RegExp) => HTMLElement);

    await waitFor(() => expect(loginOverride).toHaveBeenCalledTimes(1));
    expect(loginOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'override-test@example.com',
        password: 'pw1234567',
      }),
    );
    expect(defaultLogin).not.toHaveBeenCalled();
  });
});
