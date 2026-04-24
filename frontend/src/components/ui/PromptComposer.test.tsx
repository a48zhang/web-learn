import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PromptComposer from './PromptComposer';

describe('PromptComposer', () => {
  it('uses the configured textarea label and placeholder', () => {
    render(
      <PromptComposer
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="发送"
        textareaLabel="需求描述"
        placeholder="请详细说明你要修改的页面"
      />
    );

    expect(screen.getByLabelText('需求描述')).toHaveAttribute('placeholder', '请详细说明你要修改的页面');
  });

  it('calls handlers for typing and submit', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <PromptComposer
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        submitLabel="发送"
      />
    );

    fireEvent.change(screen.getByLabelText('描述你的需求'), {
      target: { value: 'revise landing hero' },
    });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(onChange).toHaveBeenCalledWith('revise landing hero');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
