import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const detail = error.response?.data?.detail;
    if (detail && Array.isArray(detail)) {
      error.response.data.detail = detail.map(d =>
        d.loc ? `${d.loc[d.loc.length-1]}: ${d.msg}` : d.msg
      ).join(', ');
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
