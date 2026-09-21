'use strict';

const store = require('../lib/store');

module.exports = function tent(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const tent = store.upsertTent(req.body || {});
  if (!tent) return res.status(400).json({ error: 'deviceId, lat and lng are required' });
  const state = store.snapshot(tent.deviceId);
  return res.status(200).json({ success: true, tent, allTents: state.allTents });
};
