import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicHomePage from './PublicHomePage';

const navigateMock = vi.hoisted(() => vi.fn());
const createTopicMock = vi.hoisted(() => vi.fn());
const loginMock = vi.hoisted(() => vi.fn());
const registerMock = vi.hoisted(() => vi.fn());
const setMetaMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: false,
}));

vi.mock('../services/api', () => ({
  topicApi: {
    create: createTopicMock,
  },
}));

vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => ({
    ...authState,
    login: loginMock,
    register: registerMock,
  }),
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
    authState.isAuthenticated = false;
    authState.isLoading = false;
    navigateMock.mockReset();
    createTopicMock.mockReset();
    loginMock.mockReset();
    registerMock.mockReset();
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

  it('continues topic creation after successful auth and navigates to the editor with the prompt', async () => {
    registerMock.mockImplementation(async () => {
      authState.isAuthenticated = true;
    });
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
    fireEvent.click(within(dialog).getByRole('button', { name: '注册' }));

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

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/topics/topic-1/edit', {
        state: { initialBuildPrompt: '做一个 中国古代史互动专题' },
      });
    });
  });
});
