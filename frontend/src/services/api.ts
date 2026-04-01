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
  UpdateTopicStatusDto
} from '@web-learn/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
};

export default api;
