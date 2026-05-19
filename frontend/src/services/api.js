import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    if (err.response?.status === 402 && err.response?.data?.codigo === 'TRIAL_VENCIDO') {
      window.location.href = '/trial-vencido';
    }
    return Promise.reject(err);
  }
);

export default api;
