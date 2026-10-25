import axios from 'axios';
export const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 65000 });
export const errorMessage = (e) =>
  e.response?.data?.error ||
  (e.code === 'ERR_NETWORK'
    ? 'The server is unavailable. Start the backend and try again.'
    : e.message || 'Please try again.');
export const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n || 0);
export const label = (s) => (s || '').toLowerCase().replaceAll('_', ' ').replaceAll('-', ' ');
export const when = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export async function upload(file, purpose) {
  if (!file) return undefined;
  const form = new FormData();
  form.append('file', file);
  form.append('purpose', purpose);
  return (await api.post('/uploads', form)).data._id;
}
