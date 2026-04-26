import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSave } from './useAutoSave';

const useEditorStoreMock = vi.hoisted(() => vi.fn());
const useAgentStoreMock = vi.hoisted(() => vi.fn());
const saveToOSSMock = vi.hoisted(() => vi.fn());

vi.mock('../stores/useEditorStore', () => ({
  useEditorStore: useEditorStoreMock,
}));

vi.mock('../stores/useAgentStore', () => ({
  useAgentStore: useAgentStoreMock,
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    saveToOSSMock.mockReset();
    useEditorStoreMock.mockReturnValue({
      hasUnsavedChanges: false,
      backupToLocal: vi.fn(),
      saveToOSS: saveToOSSMock,
    });
    useAgentStoreMock.mockImplementation((selector: (state: { visibleMessages: unknown[] }) => unknown) =>
      selector({ visibleMessages: [] })
    );
    saveToOSSMock.mockResolvedValue(true);
  });

  it('forces OSS upload when manual save is triggered, even without unsaved changes', async () => {
    const { result, unmount } = renderHook(() => useAutoSave('topic-1'));

    await result.current.save();

    expect(saveToOSSMock).toHaveBeenCalledWith('topic-1', '手动保存', { force: true });
    unmount();
  });
});
