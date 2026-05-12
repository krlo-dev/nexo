export const getToken = () => localStorage.getItem('nexo_token');
export const setToken = (token) => localStorage.setItem('nexo_token', token);
export const clearToken = () => localStorage.removeItem('nexo_token');

export const getUser = () => {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) { clearToken(); return null; }
    return payload;
  } catch {
    return null;
  }
};
