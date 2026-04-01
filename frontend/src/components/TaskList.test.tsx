import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskList from './TaskList';
import type { Task } from '@web-learn/shared';

const submissionListSpy = vi.hoisted(() => vi.fn());

vi.mock('./SubmissionForm', () => ({
  default: () => <div>Submission Form</div>,
}));

vi.mock('./SubmissionList', () => ({
  default: (props: { taskId: string; isTeacher?: boolean }) => {
    submissionListSpy(props);
    return <div>Submission List Mock</div>;
  },
}));

const tasks: Task[] = [
  {
    id: 'task-1',
    topicId: 'topic-1',
    title: '任务一',
    description: '任务描述',
    createdBy: 'teacher-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  },
];

describe('TaskList', () => {
  it('opens the teacher submission dialog with teacher mode enabled', () => {
    render(<TaskList tasks={tasks} canCreate={false} isTeacher={true} />);

    fireEvent.click(screen.getByRole('button', { name: '查看学生提交' }));

    expect(screen.getByRole('dialog', { name: '学生提交：任务一' })).toBeInTheDocument();
    expect(screen.getByText('Submission List Mock')).toBeInTheDocument();
    expect(submissionListSpy).toHaveBeenLastCalledWith({ taskId: 'task-1', isTeacher: true });
  });
});
