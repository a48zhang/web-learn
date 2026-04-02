import axios, { InternalAxiosRequestConfig } from 'axios';
import type {
  User,
  AuthResponse,
  LoginDto,
  CreateUserDto,
  ApiResponse,
  Topic,
  CreateTopicDto,
  UpdateTopicDto,
  UpdateTopicStatusDto,
  Resource,
  Task,
  CreateTaskDto,
  Submission,
  Review,
  CreateReviewDto,
  UpdateReviewDto,
  SubmissionWithContext,
} from '@web-learn/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (data: LoginDto): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', data);
    return response.data.data as AuthResponse;
  },

  register: async (data: CreateUserDto): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);
    return response.data.data as AuthResponse;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<ApiResponse<User>>('/users/me');
    return response.data.data as User;
  },

  logout: (): void => {
    localStorage.removeItem('auth_token');
  },
};

// Topic API
export const topicApi = {
  create: async (data: CreateTopicDto): Promise<Topic> => {
    const response = await api.post<ApiResponse<Topic>>('/topics', data);
    return response.data.data as Topic;
  },

  getAll: async (): Promise<Topic[]> => {
    const response = await api.get<ApiResponse<Topic[]>>('/topics');
    return response.data.data as Topic[];
  },

  getById: async (id: string): Promise<Topic> => {
    const response = await api.get<ApiResponse<Topic>>(`/topics/${id}`);
    return response.data.data as Topic;
  },

  update: async (id: string, data: UpdateTopicDto): Promise<Topic> => {
    const response = await api.put<ApiResponse<Topic>>(`/topics/${id}`, data);
    return response.data.data as Topic;
  },

  updateStatus: async (id: string, data: UpdateTopicStatusDto): Promise<Topic> => {
    const response = await api.patch<ApiResponse<Topic>>(`/topics/${id}/status`, data);
    return response.data.data as Topic;
  },

  join: async (id: string): Promise<{ message: string }> => {
    const response = await api.post<ApiResponse<{ message: string }>>(`/topics/${id}/join`);
    return response.data.data as { message: string };
  },
};

// Resource API
export const resourceApi = {
  upload: async (topicId: string, formData: FormData): Promise<Resource> => {
    const response = await api.post<ApiResponse<Resource>>(`/topics/${topicId}/resources`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as Resource;
  },

  getByTopic: async (topicId: string): Promise<Resource[]> => {
    const response = await api.get<ApiResponse<Resource[]>>(`/topics/${topicId}/resources`);
    return response.data.data as Resource[];
  },

  downloadUrl: (id: string): string => `${API_BASE_URL}/resources/${id}/download`,

  delete: async (id: string): Promise<void> => {
    await api.delete(`/resources/${id}`);
  },
};

// Task API
export const taskApi = {
  create: async (topicId: string, data: CreateTaskDto): Promise<Task> => {
    const response = await api.post<ApiResponse<Task>>(`/topics/${topicId}/tasks`, data);
    return response.data.data as Task;
  },

  getByTopic: async (topicId: string): Promise<Task[]> => {
    const response = await api.get<ApiResponse<Task[]>>(`/topics/${topicId}/tasks`);
    return response.data.data as Task[];
  },
};

// Submission API
export const submissionApi = {
  submit: async (taskId: string, formData: FormData): Promise<Submission> => {
    const response = await api.post<ApiResponse<Submission>>(`/tasks/${taskId}/submit`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as Submission;
  },

  getByTask: async (taskId: string): Promise<Submission[]> => {
    const response = await api.get<ApiResponse<Submission[]>>(`/tasks/${taskId}/submissions`);
    return response.data.data as Submission[];
  },

  getMySubmissions: async (): Promise<SubmissionWithContext[]> => {
    const response = await api.get<ApiResponse<SubmissionWithContext[]>>('/submissions/me');
    return response.data.data as SubmissionWithContext[];
  },
};

// Review API
export const reviewApi = {
  create: async (submissionId: string, data: CreateReviewDto): Promise<Review> => {
    const response = await api.post<ApiResponse<Review>>(`/submissions/${submissionId}/review`, data);
    return response.data.data as Review;
  },

  getBySubmission: async (submissionId: string): Promise<Review> => {
    const response = await api.get<ApiResponse<Review>>(`/submissions/${submissionId}/review`);
    return response.data.data as Review;
  },

  update: async (reviewId: string, data: UpdateReviewDto): Promise<Review> => {
    const response = await api.put<ApiResponse<Review>>(`/reviews/${reviewId}`, data);
    return response.data.data as Review;
  },
};

export default api;
