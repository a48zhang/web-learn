import { useState } from 'react';
import type { Task, Submission } from '@web-learn/shared';
import SubmissionForm from './SubmissionForm';
import SubmissionList from './SubmissionList';

interface TaskListProps {
  tasks: Task[];
  canCreate: boolean;
  isTeacher: boolean;
  onTaskClick?: (task: Task) => void;
  onSubmissionSuccess?: (taskId: string, submission: Submission) => void;
}

function TaskList({ tasks, isTeacher, onSubmissionSuccess }: TaskListProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);

  const handleSubmitSuccess = (submission: Submission) => {
    if (onSubmissionSuccess && selectedTask) {
      onSubmissionSuccess(selectedTask.id, submission);
    }
    setShowSubmissionForm(false);
    setSelectedTask(null);
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-gray-500 text-center py-8">
          暂无任务
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div key={task.id} className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
            <div className="text-sm text-gray-500">
              创建于 {new Date(task.createdAt).toLocaleDateString()}
            </div>
          </div>
          {task.description && (
            <p className="text-gray-600 mb-4 whitespace-pre-wrap">{task.description}</p>
          )}
          <div className="flex gap-2">
            {!isTeacher && (
              <button
                onClick={() => {
                  setSelectedTask(task);
                  setShowSubmissionForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                提交任务
              </button>
            )}
            {isTeacher && (
              <button
                onClick={() => {
                  setSelectedTask(task);
                  setShowSubmissions(true);
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                查看提交
              </button>
            )}
          </div>
        </div>
      ))}

      {showSubmissionForm && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">提交任务: {selectedTask.title}</h3>
              <button
                onClick={() => {
                  setShowSubmissionForm(false);
                  setSelectedTask(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <SubmissionForm
              taskId={selectedTask.id}
              onSubmitSuccess={handleSubmitSuccess}
              onSubmitError={(error) => alert(error)}
              onCancel={() => {
                setShowSubmissionForm(false);
                setSelectedTask(null);
              }}
            />
          </div>
        </div>
      )}

      {showSubmissions && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">提交列表: {selectedTask.title}</h3>
              <button
                onClick={() => {
                  setShowSubmissions(false);
                  setSelectedTask(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <SubmissionList taskId={selectedTask.id} />
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskList;
