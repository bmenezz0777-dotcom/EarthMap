'use strict';

const store = require('../lib/store');

module.exports = function state(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const snapshot = store.snapshot();
  return res.status(200).json({ success: true, allTents: snapshot.allTents, users: snapshot.friends });
};
