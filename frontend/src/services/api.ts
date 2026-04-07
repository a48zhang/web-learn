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
  TopicPage,
  TopicPageTreeNode,
  CreateTopicPageDto,
  UpdateTopicPageDto,
  ReorderTopicPagesDto,
  AIChatRequestDto,
  AIChatResponseDto,
  WebsiteStats,
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
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const method = error.config?.method?.toUpperCase() ?? 'GET';
      const url: string = error.config?.url || '';
      const isPublicGet = method === 'GET' && (url.startsWith('/topics') || url.startsWith('/pages/'));
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

  uploadWebsite: async (id: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiResponse<string>>(`/topics/${id}/website/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as string;
  },

  deleteWebsite: async (id: string): Promise<Topic> => {
    const response = await api.delete<ApiResponse<Topic>>(`/topics/${id}/website`);
    return response.data.data as Topic;
  },

  getWebsiteStats: async (id: string): Promise<WebsiteStats> => {
    const response = await api.get<ApiResponse<WebsiteStats>>(`/topics/${id}/website/stats`);
    return response.data.data as WebsiteStats;
  },

  delete: async (id: string): Promise<DeleteTopicResponse> => {
    const response = await api.delete<ApiResponse<DeleteTopicResponse>>(`/topics/${id}`);
    return response.data.data as DeleteTopicResponse;
  },
};

// Topic pages API
export const pageApi = {
  create: async (topicId: string, data: CreateTopicPageDto): Promise<TopicPage> => {
    const response = await api.post<ApiResponse<TopicPage>>(`/topics/${topicId}/pages`, data);
    return response.data.data as TopicPage;
  },

  getByTopic: async (topicId: string): Promise<TopicPageTreeNode[]> => {
    const response = await api.get<ApiResponse<TopicPageTreeNode[]>>(`/topics/${topicId}/pages`);
    return response.data.data as TopicPageTreeNode[];
  },

  getById: async (id: string): Promise<TopicPage> => {
    const response = await api.get<ApiResponse<TopicPage>>(`/pages/${id}`);
    return response.data.data as TopicPage;
  },

  update: async (id: string, data: UpdateTopicPageDto): Promise<TopicPage> => {
    const response = await api.put<ApiResponse<TopicPage>>(`/pages/${id}`, data);
    return response.data.data as TopicPage;
  },

  delete: async (id: string): Promise<{ deleted: string[] }> => {
    const response = await api.delete<ApiResponse<{ deleted: string[] }>>(`/pages/${id}`);
    return response.data.data as { deleted: string[] };
  },

  reorder: async (topicId: string, data: ReorderTopicPagesDto): Promise<TopicPageTreeNode[]> => {
    const response = await api.patch<ApiResponse<TopicPageTreeNode[]>>(
      `/topics/${topicId}/pages/reorder`,
      data
    );
    return response.data.data as TopicPageTreeNode[];
  },
};

// AI API
export const aiApi = {
  chat: async (data: AIChatRequestDto): Promise<AIChatResponseDto> => {
    const response = await api.post<AIChatResponseDto>('/ai/chat', data);
    return response.data;
  },
};

// Topic file operations (editor)
export const topicFileApi = {
  saveSnapshot: async (topicId: string, files: Record<string, string>): Promise<void> => {
    await api.put(`/topics/${topicId}/files`, { files });
  },

  loadSnapshot: async (topicId: string): Promise<Record<string, string> | null> => {
    const response = await api.get<ApiResponse<any>>(`/topics/${topicId}`);
    const data = response.data.data;
    return data?.filesSnapshot ?? null;
  },

  saveChatHistory: async (topicId: string, messages: any[]): Promise<void> => {
    await api.put(`/topics/${topicId}/chat-history`, { messages });
  },
};

export default api;
