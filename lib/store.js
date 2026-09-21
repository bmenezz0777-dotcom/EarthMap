'use strict';

// Intentionally ephemeral: the radar only needs the active festival session.
// Vercel can recycle function instances at any time, so this is a graceful
// best-effort directory rather than a promise of durable location history.
const users = new Map();
const tents = new Map();
const ACTIVE_FOR_MS = 15 * 60 * 1000;

function isCoordinate(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function cleanNick(value) {
  return typeof value === 'string' ? value.trim().slice(0, 24) : '';
}

function prune(now = Date.now()) {
  for (const [id, user] of users) {
    if (now - user.lastSeen > ACTIVE_FOR_MS) users.delete(id);
  }
}

function upsertUser(input) {
  const now = Date.now();
  const id = typeof input.deviceId === 'string' ? input.deviceId.slice(0, 80) : '';
  if (!id) return null;
  const user = {
    id,
    nick: cleanNick(input.nick) || 'Guerreiro da Paz',
    lat: isCoordinate(input.lat, -90, 90) ? input.lat : null,
    lng: isCoordinate(input.lng, -180, 180) ? input.lng : null,
    accuracy: typeof input.accuracy === 'number' && input.accuracy >= 0 ? input.accuracy : null,
    heading: typeof input.heading === 'number' ? input.heading : null,
    lastSeen: now
  };
  users.set(id, user);
  return user;
}

function upsertTent(input) {
  const id = typeof input.deviceId === 'string' ? input.deviceId.slice(0, 80) : '';
  if (!id || !isCoordinate(input.lat, -90, 90) || !isCoordinate(input.lng, -180, 180)) return null;
  const tent = {
    deviceId: id,
    nick: cleanNick(input.nick) || 'Amigo Earthdance',
    lat: input.lat,
    lng: input.lng,
    accuracy: typeof input.accuracy === 'number' && input.accuracy >= 0 ? input.accuracy : 5,
    savedAt: typeof input.savedAt === 'number' ? input.savedAt : Date.now()
  };
  tents.set(id, tent);
  return tent;
}

function snapshot(excludeId) {
  prune();
  return {
    friends: [...users.values()].filter(user => user.id !== excludeId),
    allTents: [...tents.values()]
  };
}

module.exports = { upsertUser, upsertTent, snapshot, users, tents };
