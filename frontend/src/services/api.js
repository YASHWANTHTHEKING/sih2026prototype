import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAOIList = async () => {
  const res = await apiClient.get('/layers/aois');
  return res.data;
};

export const getAOIMetadata = async (aoiId) => {
  const res = await apiClient.get(`/layers/metadata/${aoiId}`);
  return res.data;
};

export const getLayerGeoJSON = async (aoiId, layerName) => {
  const res = await apiClient.get(`/layers/geojson/${aoiId}/${layerName}`);
  return res.data;
};

export const runFullPipeline = async (params) => {
  const res = await apiClient.post('/pipeline/run-full', params);
  return res.data;
};

export const getAnalyticsSummary = async (aoiId) => {
  const res = await apiClient.get(`/analytics/summary/${aoiId}`);
  return res.data;
};

export const getBenchmarks = async (aoiId) => {
  const res = await apiClient.get(`/benchmark/run/${aoiId}`);
  return res.data;
};

export const splitParcel = async (params) => {
  const res = await apiClient.post('/editor/split', params);
  return res.data;
};

export const mergeParcels = async (params) => {
  const res = await apiClient.post('/editor/merge', params);
  return res.data;
};

export const updateAttributes = async (params) => {
  const res = await apiClient.post('/editor/update-attributes', params);
  return res.data;
};

export const actionAiPolygon = async (params) => {
  const res = await apiClient.post('/editor/action-ai-polygon', params);
  return res.data;
};

export const submitGtSignoff = async (params) => {
  const res = await apiClient.post('/gt/signoff', params);
  return res.data;
};

export const getAuditTrail = async (aoiId) => {
  const res = await apiClient.get(`/gt/audit-trail/${aoiId}`);
  return res.data;
};

export const generateExports = async (aoiId) => {
  const res = await apiClient.post(`/export/generate/${aoiId}`);
  return res.data;
};

export const createCustomAOI = async (params) => {
  const res = await apiClient.post('/pipeline/custom-aoi', params);
  return res.data;
};

export const autoTrimConflict = async (params) => {
  const res = await apiClient.post('/editor/auto-trim-conflict', params);
  return res.data;
};

export const snapToGnssAnchor = async (params) => {
  const res = await apiClient.post('/editor/snap-gnss', params);
  return res.data;
};
