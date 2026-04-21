import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage, { buildTopicTitleFromPrompt } from './DashboardPage';

const navigateMock = vi.hoisted(() => vi.fn());
const createTopicMock = vi.hoisted(() => vi.fn());
const setMetaMock = vi.hoisted(() => vi.fn());

vi.mock('../services/api', () => ({
  topicApi: {
    create: createTopicMock,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../components/layout/LayoutMetaContext', () => ({
  useLayoutMeta: () => ({ meta: {}, setMeta: setMetaMock }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    createTopicMock.mockReset();
    setMetaMock.mockReset();
  });

  it('renders the ai create entry surface and removes the old dashboard blocks', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: '想做什么学习专题？' })).toBeInTheDocument();
    expect(screen.getByLabelText('描述专题需求')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始制作' })).toBeDisabled();

    expect(screen.queryByText('创建专题')).not.toBeInTheDocument();
    expect(screen.queryByText('我的专题')).not.toBeInTheDocument();
    expect(screen.queryByText('账户设置')).not.toBeInTheDocument();
    expect(screen.queryByText('最近活动')).not.toBeInTheDocument();
  });

  it('builds a topic title from the normalized prompt', () => {
    expect(buildTopicTitleFromPrompt('  做一个 高中物理专题  ')).toBe('做一个 高中物理专题');
    expect(buildTopicTitleFromPrompt('123456789012345678901234567890')).toBe('123456789012345678901234567890');
    expect(buildTopicTitleFromPrompt('1234567890123456789012345678901')).toBe('123456789012345678901234567890...');
  });

  it('creates a website topic from the normalized prompt and navigates to the editor', async () => {
    createTopicMock.mockResolvedValueOnce({ id: 'topic-1' });

    render(<DashboardPage />);

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '  做一个 高中物理电磁感应互动专题  ' },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始制作' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始制作' }));

    await waitFor(() => {
      expect(createTopicMock).toHaveBeenCalledWith({
        title: '做一个 高中物理电磁感应互动专题',
        description: '做一个 高中物理电磁感应互动专题',
        type: 'website',
      });
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/topics/topic-1/edit', {
        state: { initialBuildPrompt: '做一个 高中物理电磁感应互动专题' },
      });
    });
  });

  it('prevents duplicate create calls while the request is pending', async () => {
    let resolveCreate: (value: { id: string }) => void = () => undefined;
    const createPromise = new Promise<{ id: string }>((resolve) => {
      resolveCreate = resolve;
    });
    createTopicMock.mockReturnValueOnce(createPromise);

    render(<DashboardPage />);

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '  做一个 高中物理电磁感应互动专题  ' },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始制作' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始制作' }));
    fireEvent.click(screen.getByRole('button', { name: '开始制作' }));

    expect(createTopicMock).toHaveBeenCalledTimes(1);

    resolveCreate({ id: 'topic-1' });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/topics/topic-1/edit', {
        state: { initialBuildPrompt: '做一个 高中物理电磁感应互动专题' },
      });
    });
  });

  it('does nothing for a blank prompt', () => {
    render(<DashboardPage />);

    fireEvent.submit(screen.getByRole('form', { name: 'AI 创建专题' }));

    expect(createTopicMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows an inline error when topic creation fails', async () => {
    createTopicMock.mockRejectedValueOnce(new Error('服务暂不可用'));

    render(<DashboardPage />);

    fireEvent.change(screen.getByLabelText('描述专题需求'), {
      target: { value: '  做一个 高中物理电磁感应互动专题  ' },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始制作' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始制作' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('做一个 高中物理电磁感应互动专题')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('服务暂不可用');
    });
  });
});
