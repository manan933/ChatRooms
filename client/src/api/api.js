const API_BASE = '';

const getToken = () => localStorage.getItem('chatrooms_token') || localStorage.getItem('zyntra_token');

export const getFileUrl = (url) => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

export async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `HTTP error ${res.status}`;
      return { ok: false, error: errorMsg, status: res.status };
    }

    return { ok: true, data: data?.data !== undefined ? data.data : data, raw: data };
  } catch (err) {
    return { ok: false, error: err.message || 'Network request failed' };
  }
}

export const api = {
  auth: {
    login: (credentials) =>
      request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (payload) =>
      request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    me: () => request('/api/auth/me'),
    updateProfile: (data) =>
      request('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    updatePassword: (data) =>
      request('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  contacts: {
    list: () => request('/api/contacts'),
    search: (query) => request(`/api/contacts/search?q=${encodeURIComponent(query)}`),
    add: (contactUsername) =>
      request('/api/contacts', {
        method: 'POST',
        body: JSON.stringify({ contactUsername }),
      }),
    createGroup: (groupData) =>
      request('/api/contacts/groups', {
        method: 'POST',
        body: JSON.stringify(groupData),
      }),
  },

  workspaces: {
    list: () => request('/api/workspaces'),
    nodes: () => request('/api/workspaces/nodes'),
    create: (data) =>
      request('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    createNode: (wsId, nodeData) =>
      request(`/api/workspaces/${wsId}/nodes`, {
        method: 'POST',
        body: JSON.stringify(nodeData),
      }),
    join: (code) =>
      request('/api/workspaces/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    addMembers: (nodeId, members) =>
      request(`/api/workspaces/nodes/${nodeId}/members`, {
        method: 'POST',
        body: JSON.stringify({ members }),
      }),
    removeMember: (nodeId, memberId) =>
      request(`/api/workspaces/nodes/${nodeId}/members/${memberId}`, {
        method: 'DELETE',
      }),
  },

  messages: {
    byChat: (chatId) => request(`/api/messages/${chatId}`),
    markRead: (chatId) =>
      request(`/api/messages/${chatId}/read`, {
        method: 'POST',
      }),
    send: (chatId, payload) =>
      request(`/api/messages/${chatId}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    edit: (messageId, content) =>
      request(`/api/messages/${messageId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    delete: (messageId) =>
      request(`/api/messages/${messageId}`, {
        method: 'DELETE',
      }),
    reaction: (messageId, emoji, userId, action) =>
      request(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji, userId, action }),
      }),
  },

  upload: {
    file: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return request('/api/upload/file', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
    },
  },
};

export default api;
