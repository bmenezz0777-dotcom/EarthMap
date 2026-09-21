'use strict';

const store = require('../lib/store');

module.exports = function ping(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const user = store.upsertUser(body);
  if (!user) return res.status(400).json({ error: 'deviceId is required' });

  if (body.tent) store.upsertTent({ ...body.tent, deviceId: user.id, nick: user.nick });
  const state = store.snapshot(user.id);
  return res.status(200).json({
    success: true,
    serverTime: Date.now(),
    totalOnline: state.friends.length + 1,
    ...state,
    myTent: store.tents.get(user.id) || null
  });
};
