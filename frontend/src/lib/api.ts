import axios from 'axios';

export const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const http = axios.create({ baseURL: API, timeout: 20000 });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('tb_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// pull the server's message out so pages can show something specific instead of "Request failed"
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err?.response?.data?.error || err?.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  },
);

export const unwrap = <T>(p: Promise<{ data: T }>): Promise<T> => p.then((r) => r.data);

export const money = (value: number | undefined | null) =>
  `Rs ${Math.round(value || 0).toLocaleString('en-PK')}`;

export const acceptingOrdersNow = (open?: boolean) => open !== false;

/** the API stores photos as an array; the UI only ever shows the first one */
export const mainImage = (images?: { url: string }[] | string) => {
  if (typeof images === 'string') return images;
  return images?.[0]?.url || '';
};

/** turns the stored estimate into the copy the storefront promises */
export const deliveryWindow = (minutes?: number) => {
  const m = minutes || 40;
  return `${Math.max(15, m - 10)}–${m} minutes`;
};

/** downloads a file through axios so the admin auth token travels with the request */
export const downloadFile = async (url: string, filename: string) => {
  const res = await http.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
};
