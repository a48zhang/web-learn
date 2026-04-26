import { useSyncExternalStore } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicHomePage from './PublicHomePage';

const navigateMock = vi.hoisted(() => vi.fn());
const createTopicMock = vi.hoisted(() => vi.fn());
const setMetaMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

type AuthSnapshot = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

const authStore = vi.hoisted(() => {
  let snapshot: AuthSnapshot = {
    isAuthenticated: false,
    isLoading: false,
  };
  const listeners = new Set<() => void>();
  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    reset: () => {
      snapshot = {
        isAuthenticated: false,
        isLoading: false,
      };
      emit();
    },
    setState: (nextState: Partial<AuthSnapshot>) => {
      snapshot = {
        ...snapshot,
        ...nextState,
      };
      emit();
    },
  };
});

const loginMock = vi.hoisted(() =>
  vi.fn(async () => {
    authStore.setState({ isAuthenticated: true, isLoading: false });
  })
);

const registerMock = vi.hoisted(() =>
  vi.fn(async () => {
    authStore.setState({ isAuthenticated: true, isLoading: false });
  })
);

vi.mock('../services/api', () => ({
  topicApi: {
    create: createTopicMock,
  },
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => {
    const snapshot = useSyncExternalStore(authStore.subscribe, authStore.getSnapshot);
    return {
      ...snapshot,
      login: loginMock,
      register: registerMock,
    };
  },
}));

vi.mock('../stores/useToastStore', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock('../components/layout/LayoutMetaContext', () => ({
  useLayoutMeta: () => ({ meta: {}, setMeta: setMetaMock }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('PublicHomePage', () => {
  beforeEach(() => {
    authStore.reset();
    navigateMock.mockReset();
    createTopicMock.mockReset();
    loginMock.mockClear();
    registerMock.mockClear();
    setMetaMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('renders only the centered prompt entry instead of marketing sections', () => {
    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('描述专题需求')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始创建' })).toBeDisabled();
    expect(screen.queryByText('为什么选择 WebLearn？')).not.toBeInTheDocument();
    expect(screen.queryByText('热门专题')).not.toBeInTheDocument();
    expect(screen.queryByText('准备好开始了吗？')).not.toBeInTheDocument();
  });

  it('opens the auth dialog and preserves the prompt when an unauthenticated user submits', async () => {
    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '做一个中国古代史互动专题' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始创建' }));

    expect(await screen.findByRole('dialog', { name: '注册对话框' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('做一个中国古代史互动专题')).toBeInTheDocument();
    expect(createTopicMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('continues topic creation after successful auth without redirecting to dashboard first', async () => {
    createTopicMock.mockResolvedValueOnce({ id: 'topic-1' });

    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '  做一个 中国古代史互动专题  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始创建' }));

    const dialog = await screen.findByRole('dialog', { name: '注册对话框' });

    fireEvent.change(screen.getByLabelText('用户名'), {
      target: { value: 'tester' },
    });
    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'tester@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText('确认密码'), {
      target: { value: 'password123' },
    });
    fireEvent.click(within(dialog).getAllByRole('button', { name: '注册' })[1]);

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith('tester', 'tester@example.com', 'password123');
    });

    await waitFor(() => {
      expect(createTopicMock).toHaveBeenCalledWith({
        title: '做一个 中国古代史互动专题',
        description: '做一个 中国古代史互动专题',
        type: 'website',
      });
    });

    expect(navigateMock).not.toHaveBeenCalledWith('/dashboard', { replace: true });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/topics/topic-1/edit', {
        state: { initialBuildPrompt: '做一个 中国古代史互动专题' },
      });
    });
  });

  it('does not create a topic when header auth succeeds without create intent', async () => {
    render(
      <MemoryRouter>
        <PublicHomePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '做一个不会自动创建的专题' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: '登录' })[0]);

    const dialog = await screen.findByRole('dialog', { name: '登录对话框' });

    fireEvent.change(screen.getByLabelText('邮箱地址'), {
      target: { value: 'tester@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' },
    });
    fireEvent.click(within(dialog).getAllByRole('button', { name: '登录' })[1]);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('tester@example.com', 'password123');
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/', { replace: true });
    });

    expect(createTopicMock).not.toHaveBeenCalled();
  });
});
