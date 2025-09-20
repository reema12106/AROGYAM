import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { abha_number: string; phone_number: string; name: string }) =>
    api.post('/api/auth/register', data),
  
  sendOtp: (data: { abha_number: string; phone_number: string }) =>
    api.post('/api/auth/send-otp', data),
  
  verifyOtp: (data: { abha_number: string; phone_number: string; otp_code: string }) =>
    api.post('/api/auth/verify-otp', data),
  
  validateToken: () =>
    api.post('/api/auth/validate-token'),
  
  getUserProfile: () =>
    api.get('/api/auth/user-profile'),
};

// Search API
export const searchApi = {
  searchConditions: (params: { q: string; limit?: number; page?: number; patient_id?: string }) =>
    api.get('/search/conditions', { params }),
  
  getMappingProfile: (namasteCode: string, patientId?: string) =>
    api.get(`/mapping-profile/${namasteCode}`, { 
      params: patientId ? { patient_id: patientId } : {} 
    }),
  
  searchIcd11: (params: { q: string; mapping_type?: string; limit?: number; patient_id?: string }) =>
    api.get('/search/icd11', { params }),
  
  getMappingStats: () =>
    api.get('/mapping-stats'),
};

// FHIR API
export const fhirApi = {
  getCodeSystem: () =>
    api.get('/fhir/CodeSystem/namaste'),
  
  getConceptMap: () =>
    api.get('/fhir/ConceptMap/namaste-icd11'),
  
  getValueSet: (name?: string) =>
    api.get('/fhir/ValueSet/namaste-codes', { params: name ? { name } : {} }),
  
  translate: (data: { code: string; system?: string }) =>
    api.post('/fhir/ConceptMap/namaste-icd11/$translate', data),
};

// Encounter API
export const encounterApi = {
  createEncounter: (data: { patient_id: string; encounter_type?: string; notes?: string }) =>
    api.post('/encounters', data),
  
  addProblem: (encounterId: number, data: { 
    code_system: string; 
    code: string; 
    display_name?: string; 
    severity?: string 
  }) =>
    api.post(`/encounters/${encounterId}/problems`, data),
};

// Health API
export const healthApi = {
  getHealth: () =>
    api.get('/health'),
  
  ping: () =>
    api.get('/ping'),
  
  dbCheck: () =>
    api.get('/db-check'),
};