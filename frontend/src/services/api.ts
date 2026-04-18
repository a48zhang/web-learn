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
  DeleteTopicResponse,
  PersistedConversationState,
} from '@web-learn/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
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
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const method = error.config?.method?.toUpperCase() ?? 'GET';
      const url: string = error.config?.url || '';
      const isPublicGet = method === 'GET' && url.startsWith('/topics');
      if (!isPublicGet) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
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

  updateMe: async (data: { username?: string }): Promise<User> => {
    const response = await api.put<ApiResponse<User>>('/users/me', data);
    return response.data.data as User;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    const response = await api.post<ApiResponse<{ message: string }>>('/users/me/change-password', data);
    return response.data.data as unknown as void;
  },
};

// Topic API
export const topicApi = {
  create: async (data: CreateTopicDto): Promise<Topic> => {
    const response = await api.post<ApiResponse<Topic>>('/topics', data);
    return response.data.data as Topic;
  },

  getAll: async (params?: { type?: 'website' }): Promise<Topic[]> => {
    const response = await api.get<ApiResponse<Topic[]>>('/topics', { params });
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

  delete: async (id: string): Promise<DeleteTopicResponse> => {
    const response = await api.delete<ApiResponse<DeleteTopicResponse>>(`/topics/${id}`);
    return response.data.data as DeleteTopicResponse;
  },
};

// Topic git operations (clone/push via OSS presigned URLs)
export const topicGitApi = {
  getPresign: async (topicId: string, op: 'upload' | 'download' | 'publish'): Promise<{ url: string; method: string; contentType?: string }> => {
    const response = await api.get<ApiResponse<{ url: string; method: string; contentType?: string }>>(
      `/topics/${topicId}/git/presign`,
      { params: { op } }
    );
    return response.data.data!;
  },
};

// Agent Conversation API
export const agentConversationApi = {
  getConversation: async (topicId: string, agentType: 'building' | 'learning'): Promise<PersistedConversationState> => {
    const response = await api.get<ApiResponse<PersistedConversationState>>(`/ai/conversations/${topicId}/${agentType}`);
    return response.data.data as PersistedConversationState;
  },
  
  replaceConversation: async (
    topicId: string,
    agentType: 'building' | 'learning',
    payload: PersistedConversationState
  ): Promise<PersistedConversationState> => {
    const response = await api.put<ApiResponse<PersistedConversationState>>(
      `/ai/conversations/${topicId}/${agentType}`,
      payload
    );
    return response.data.data as PersistedConversationState;
  },
};

export default api;
