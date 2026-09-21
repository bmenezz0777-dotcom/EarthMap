// ===================================================
// EARTHDANCE RADAR — CLIENT LOGIC
// 100% Free · Zero API Keys · Real-time GPS & Compass
// ===================================================

(function() {
  'use strict';

  // State
  const state = {
    deviceId: getOrCreateDeviceId(),
    nickname: localStorage.getItem('earthdance_nick') || '',
    myLocation: { latitude: null, longitude: null, accuracy: null, speed: null },
    heading: null,
    compassActive: false,
    myTent: getStoredTent(),
    friends: [],
    allTents: [],
    target: null, // { type: 'user'|'tent'|'mine', id: string, name: string, latitude: number, longitude: number }
    map: null,
    mapMarkers: {
      me: null,
      myTent: null,
      friends: new Map(),
      tents: new Map()
    },
    syncInterval: null,
    currentTab: 'radar'
  };

  // DOM
  const dom = {
    setupScreen: document.getElementById('setup-screen'),
    setupForm: document.getElementById('setup-form'),
    setupNickname: document.getElementById('setup-nickname'),
    connectionStatus: document.getElementById('connection-status'),
    hudNick: document.getElementById('hud-nick'),
    hudGps: document.getElementById('hud-gps'),
    hudCompass: document.getElementById('hud-compass'),
    targetPulse: document.getElementById('target-pulse'),
    targetLabel: document.getElementById('target-label'),
    targetDistDisplay: document.getElementById('target-dist-display'),
    targetDirDisplay: document.getElementById('target-dir-display'),
    btnActivateCompass: document.getElementById('btn-activate-compass'),
    btnFixTent: document.getElementById('btn-fix-tent'),
    btnStopFollow: document.getElementById('btn-stop-follow'),
    myTentCard: document.getElementById('my-tent-card'),
    btnAimMyTent: document.getElementById('btn-aim-my-tent'),
    nearbyCount: document.getElementById('nearby-count'),
    nearbyChipsContainer: document.getElementById('nearby-chips-container'),
    btnViewAllPeople: document.getElementById('btn-view-all-people'),
    peopleTotal: document.getElementById('people-total'),
    peopleListContainer: document.getElementById('people-list-container'),
    settingsNickDisplay: document.getElementById('settings-nick-display'),
    settingsNickInput: document.getElementById('settings-nick-input'),
    btnSaveSettingsNick: document.getElementById('btn-save-settings-nick'),
    btnTestGps: document.getElementById('btn-test-gps'),
    btnTestCompass: document.getElementById('btn-test-compass'),
    btnRemoveTent: document.getElementById('btn-remove-tent'),
    btnCenterMe: document.getElementById('btn-center-me'),
    btnCenterTent: document.getElementById('btn-center-tent'),
    toast: document.getElementById('toast'),
    toastText: document.getElementById('toast-text'),
    toastClose: document.getElementById('toast-close'),
    navBtns: document.querySelectorAll('.nav-btn'),
    tabPages: {
      radar: document.getElementById('tab-radar-view'),
      map: document.getElementById('tab-map-view'),
      people: document.getElementById('tab-people-view'),
      settings: document.getElementById('tab-settings-view')
    }
  };

  // ===================================================
  // 1. BOOTSTRAP & IDENTITY
  // ===================================================
  function init() {
    checkIdentity();
    setupNavigation();
    setupActions();
    startGps();
    startSync();
  }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem('earthdance_device_id');
    if (!id) {
      id = 'ed_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('earthdance_device_id', id);
    }
    return id;
  }

  function getStoredTent() {
    try {
      const stored = localStorage.getItem('earthdance_my_tent');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  function checkIdentity() {
    if (!state.nickname) {
      dom.setupScreen.classList.remove('hidden');
    } else {
      updateNickUI(state.nickname);
    }

    dom.setupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = dom.setupNickname.value.trim();
      const nick = val || 'Guerreiro #' + state.deviceId.slice(-4);
      saveNick(nick);
      dom.setupScreen.classList.add('hidden');
    });

    if (state.myTent) {
      dom.myTentCard.classList.remove('hidden');
      dom.btnRemoveTent.classList.remove('hidden');
    }
  }

  function saveNick(nick) {
    state.nickname = nick;
    localStorage.setItem('earthdance_nick', nick);
    updateNickUI(nick);
    sync();
    showToast('Bem-vindo à Earthdance, ' + nick + '! 🌿');
  }

  function updateNickUI(nick) {
    dom.hudNick.textContent = nick;
    dom.settingsNickDisplay.textContent = nick;
    dom.settingsNickInput.value = nick;
  }

  // ===================================================
  // 2. TABS & BOTTOM NAVIGATION
  // ===================================================
  function setupNavigation() {
    dom.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    dom.btnViewAllPeople.addEventListener('click', () => {
      switchTab('people');
    });
  }

  function switchTab(tabName) {
    state.currentTab = tabName;

    dom.navBtns.forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.tab === tabName);
    });

    Object.keys(dom.tabPages).forEach(key => {
      dom.tabPages[key].classList.toggle('active', key === tabName);
    });

    if (tabName === 'map') {
      ensureMap();
    }
  }

  // ===================================================
  // 3. SENSORS: GPS & COMPASS
  // ===================================================
  function startGps() {
    if (!('geolocation' in navigator)) {
      dom.hudGps.textContent = 'Sem GPS';
      return;
    }

    navigator.geolocation.watchPosition(
      (pos) => {
        state.myLocation.latitude = pos.coords.latitude;
        state.myLocation.longitude = pos.coords.longitude;
        state.myLocation.accuracy = pos.coords.accuracy;
        state.myLocation.speed = pos.coords.speed;

        const acc = Math.round(pos.coords.accuracy);
        dom.hudGps.textContent = `±${acc}m`;

        updateRadarNavigation();
        updateMapSelf();
      },
      (err) => {
        console.warn('GPS Error:', err);
        dom.hudGps.textContent = 'Erro';
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000
      }
    );
  }

  function activateCompass() {
    const handleOrientation = (e) => {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') {
        h = e.webkitCompassHeading;
      } else if (e.alpha !== null) {
        h = (360 - e.alpha) % 360;
      }

      if (h !== null) {
        state.heading = h;
        state.compassActive = true;
        dom.hudCompass.textContent = 'ATIVA';
        dom.btnActivateCompass.textContent = '🧭 BÚSSOLA ATIVA';
        dom.btnActivateCompass.classList.add('active');
        updateRadarNavigation();
      }
    };

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(res => {
          if (res === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
            showToast('Bússola ativada com sucesso!');
          } else {
            showToast('Permissão de bússola negada.');
          }
        })
        .catch(err => {
          console.warn(err);
          showToast('Erro ao ativar bússola.');
        });
    } else {
      window.addEventListener('deviceorientation', handleOrientation, true);
      showToast('Bússola ativada!');
    }
  }

  // ===================================================
  // 4. MATHEMATICS: HAVERSINE & BEARING
  // ===================================================
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  function calculateBearing(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function formatDistance(meters) {
    if (meters == null) return '—';
    if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
    return meters + ' m';
  }

  function updateRadarNavigation() {
    const { myLocation, target, heading } = state;

    if (!target) {
      dom.targetLabel.textContent = 'SELECIONE UMA PESSOA';
      dom.targetDistDisplay.textContent = '♥';
      dom.targetDirDisplay.textContent = 'ou marque sua barraca';
      dom.btnStopFollow.classList.add('hidden');
      return;
    }

    dom.btnStopFollow.classList.remove('hidden');

    if (myLocation.latitude === null || myLocation.longitude === null) {
      dom.targetLabel.textContent = 'SEGUINDO ' + target.name.toUpperCase();
      dom.targetDistDisplay.textContent = '...';
      dom.targetDirDisplay.textContent = 'Aguardando sinal GPS';
      return;
    }

    const dist = calculateDistance(
      myLocation.latitude, myLocation.longitude,
      target.latitude, target.longitude
    );

    dom.targetLabel.textContent = 'SEGUINDO ' + target.name.toUpperCase();
    dom.targetDistDisplay.textContent = formatDistance(dist);

    const bearing = calculateBearing(
      myLocation.latitude, myLocation.longitude,
      target.latitude, target.longitude
    );

    const currentHeading = heading != null ? heading : 0;
    const relativeAngle = (bearing - currentHeading + 360) % 360;

    dom.targetPulse.style.transform = `rotate(${relativeAngle}deg)`;

    let dirText = `${Math.round(bearing)}° NO MAPA`;
    if (heading != null) {
      const diff = relativeAngle > 180 ? relativeAngle - 360 : relativeAngle;
      const absDiff = Math.abs(diff);
      if (absDiff <= 12) {
        dirText = '⬆ EM FRENTE';
      } else if (diff > 0) {
        dirText = `↗ ${Math.round(absDiff)}° À DIREITA`;
      } else {
        dirText = `↖ ${Math.round(absDiff)}° À ESQUERDA`;
      }
    }

    dom.targetDirDisplay.textContent = dirText;
  }

  function setTarget(targetObj) {
    state.target = targetObj;
    updateRadarNavigation();
    renderPeopleList();
    renderNearbyChips();
  }

  // ===================================================
  // 5. ACTIONS: TENT & BUTTONS
  // ===================================================
  function setupActions() {
    dom.btnActivateCompass.addEventListener('click', activateCompass);

    // Fix Tent
    dom.btnFixTent.addEventListener('click', () => {
      if (state.myLocation.latitude === null) {
        alert('Aguardando sinal de GPS para fixar a barraca. Ative a localização no seu navegador!');
        return;
      }

      const tentData = {
        latitude: state.myLocation.latitude,
        longitude: state.myLocation.longitude,
        accuracy: state.myLocation.accuracy || 5,
        savedAt: Date.now()
      };

      state.myTent = tentData;
      localStorage.setItem('earthdance_my_tent', JSON.stringify(tentData));

      dom.myTentCard.classList.remove('hidden');
      dom.btnRemoveTent.classList.remove('hidden');

      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

      setTarget({
        type: 'mine',
        id: state.deviceId,
        name: 'Minha Barraca',
        latitude: tentData.latitude,
        longitude: tentData.longitude
      });

      // API save
      fetch('/api/tent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: state.deviceId,
          nick: state.nickname || 'Minha Barraca',
          lat: tentData.latitude,
          lng: tentData.longitude,
          accuracy: tentData.accuracy
        })
      }).catch(console.warn);

      showToast('🏕️ Barraca fixada com sucesso!');
      updateMapSelf();
    });

    // Aim My Tent
    dom.btnAimMyTent.addEventListener('click', () => {
      if (!state.myTent) return;
      setTarget({
        type: 'mine',
        id: state.deviceId,
        name: 'Minha Barraca',
        latitude: state.myTent.latitude,
        longitude: state.myTent.longitude
      });
      switchTab('radar');
    });

    // Stop Follow
    dom.btnStopFollow.addEventListener('click', () => {
      state.target = null;
      updateRadarNavigation();
      renderPeopleList();
      renderNearbyChips();
    });

    // Settings actions
    dom.btnSaveSettingsNick.addEventListener('click', () => {
      const val = dom.settingsNickInput.value.trim();
      if (val) saveNick(val);
    });

    dom.btnTestGps.addEventListener('click', () => {
      startGps();
      showToast('Testando GPS...');
    });

    dom.btnTestCompass.addEventListener('click', () => {
      activateCompass();
    });

    dom.btnRemoveTent.addEventListener('click', () => {
      if (confirm('Deseja realmente remover a localização da sua barraca?')) {
        state.myTent = null;
        localStorage.removeItem('earthdance_my_tent');
        dom.myTentCard.classList.add('hidden');
        dom.btnRemoveTent.classList.add('hidden');
        if (state.target && state.target.type === 'mine') {
          state.target = null;
          updateRadarNavigation();
        }
        updateMapSelf();
        showToast('Barraca removida.');
      }
    });

    // Map quick tools
    dom.btnCenterMe.addEventListener('click', () => {
      if (state.map && state.myLocation.latitude !== null) {
        state.map.setView([state.myLocation.latitude, state.myLocation.longitude], 17);
      }
    });

    dom.btnCenterTent.addEventListener('click', () => {
      if (state.map && state.myTent) {
        state.map.setView([state.myTent.latitude, state.myTent.longitude], 17);
      } else {
        showToast('Você ainda não fixou sua barraca.');
      }
    });

    // Toast close
    dom.toastClose.addEventListener('click', () => {
      dom.toast.classList.add('hidden');
    });
  }

  function showToast(text) {
    dom.toastText.textContent = text;
    dom.toast.classList.remove('hidden');
    setTimeout(() => {
      dom.toast.classList.add('hidden');
    }, 3500);
  }

  // ===================================================
  // 6. SYNC WITH VERCEL SERVERLESS API
  // ===================================================
  function startSync() {
    sync();
    state.syncInterval = setInterval(sync, 4000);
  }

  async function sync() {
    try {
      const payload = {
        deviceId: state.deviceId,
        nick: state.nickname || 'Guerreiro da Paz',
        lat: state.myLocation.latitude,
        lng: state.myLocation.longitude,
        accuracy: state.myLocation.accuracy,
        heading: state.heading,
        tent: state.myTent ? {
          lat: state.myTent.latitude,
          lng: state.myTent.longitude,
          accuracy: state.myTent.accuracy
        } : null
      };

      const res = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Status ' + res.status);

      const data = await res.json();

      dom.connectionStatus.className = 'status online';
      dom.connectionStatus.querySelector('span').textContent = 'ONLINE';

      if (Array.isArray(data.friends)) {
        state.friends = data.friends;
        dom.nearbyCount.textContent = data.friends.length;
        dom.peopleTotal.textContent = data.friends.length;
      }

      if (Array.isArray(data.allTents)) {
        state.allTents = data.allTents;
      }

      renderNearbyChips();
      renderPeopleList();
      updateMapMarkers();

    } catch (err) {
      dom.connectionStatus.className = 'status unstable';
      dom.connectionStatus.querySelector('span').textContent = 'INSTÁVEL';
    }
  }

  // ===================================================
  // 7. RENDERING LISTS
  // ===================================================
  function renderNearbyChips() {
    dom.nearbyChipsContainer.innerHTML = '';

    if (state.friends.length === 0) {
      dom.nearbyChipsContainer.innerHTML = '<div class="empty-chips">Ninguém por perto ainda...</div>';
      return;
    }

    const sorted = [...state.friends].map(f => {
      let d = null;
      if (state.myLocation.latitude !== null && f.lat !== null) {
        d = calculateDistance(state.myLocation.latitude, state.myLocation.longitude, f.lat, f.lng);
      }
      return { ...f, dist: d };
    }).sort((a, b) => (a.dist || 999999) - (b.dist || 999999));

    sorted.slice(0, 6).forEach(friend => {
      const isTarget = state.target && state.target.id === friend.id;
      const chip = document.createElement('button');
      chip.className = 'person-chip';
      chip.style.borderColor = isTarget ? 'var(--green)' : 'var(--line)';
      chip.innerHTML = `
        <span>${friend.nick.slice(0, 1).toUpperCase()}</span>
        <b>${escapeHtml(friend.nick)}</b>
        <small>${formatDistance(friend.dist)}</small>
      `;
      chip.addEventListener('click', () => {
        if (friend.lat === null) {
          showToast(friend.nick + ' ainda não tem sinal GPS.');
          return;
        }
        setTarget({
          type: 'user',
          id: friend.id,
          name: friend.nick,
          latitude: friend.lat,
          longitude: friend.lng
        });
        if ('vibrate' in navigator) navigator.vibrate(40);
      });
      dom.nearbyChipsContainer.appendChild(chip);
    });
  }

  function renderPeopleList() {
    dom.peopleListContainer.innerHTML = '';

    if (state.friends.length === 0) {
      dom.peopleListContainer.innerHTML = '<div class="empty">Ninguém apareceu ainda.<br>Quando seus amigos entrarem, eles estarão aqui.</div>';
      return;
    }

    state.friends.forEach(friend => {
      let d = null;
      if (state.myLocation.latitude !== null && friend.lat !== null) {
        d = calculateDistance(state.myLocation.latitude, state.myLocation.longitude, friend.lat, friend.lng);
      }

      const isTarget = state.target && state.target.id === friend.id;

      const card = document.createElement('div');
      card.className = 'person-card';
      card.style.borderColor = isTarget ? 'var(--green)' : 'var(--line)';
      card.innerHTML = `
        <span class="avatar">${friend.nick.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>${escapeHtml(friend.nick)}</strong>
          <small>● ONLINE ${friend.accuracy ? `· GPS ±${Math.round(friend.accuracy)}m` : ''}</small>
        </div>
        <b>${formatDistance(d)}</b>
      `;

      card.addEventListener('click', () => {
        if (friend.lat === null) {
          showToast(friend.nick + ' ainda não enviou coordenadas.');
          return;
        }
        setTarget({
          type: 'user',
          id: friend.id,
          name: friend.nick,
          latitude: friend.lat,
          longitude: friend.lng
        });
        if ('vibrate' in navigator) navigator.vibrate(40);
        switchTab('radar');
      });

      dom.peopleListContainer.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
  }

  // ===================================================
  // 8. 100% FREE LEAFLET MAP (OpenStreetMap - ZERO API Keys)
  // ===================================================
  function ensureMap() {
    if (state.map) {
      state.map.invalidateSize();
      return;
    }

    if (typeof L === 'undefined') return;

    const lat = state.myLocation.latitude || -23.55052;
    const lng = state.myLocation.longitude || -46.633308;

    state.map = L.map('map-element', {
      zoomControl: false,
      attributionControl: true
    }).setView([lat, lng], 17);

    // 100% Free OpenStreetMap Public Tiles (NO API KEY REQUIRED)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(state.map);

    updateMapSelf();
    updateMapMarkers();
  }

  function updateMapSelf() {
    if (!state.map) return;
    const { myLocation, myTent } = state;

    if (myLocation.latitude !== null) {
      if (!state.mapMarkers.me) {
        state.mapMarkers.me = L.circleMarker([myLocation.latitude, myLocation.longitude], {
          radius: 9,
          color: '#00ff88',
          fillColor: '#00ff88',
          fillOpacity: 0.9
        }).addTo(state.map).bindPopup('<strong>Você está aqui</strong>');
      } else {
        state.mapMarkers.me.setLatLng([myLocation.latitude, myLocation.longitude]);
      }
    }

    if (myTent && myTent.latitude) {
      if (!state.mapMarkers.myTent) {
        const tentIcon = L.divIcon({
          className: 'tent-marker',
          html: '<div>🏕️</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        state.mapMarkers.myTent = L.marker([myTent.latitude, myTent.longitude], { icon: tentIcon })
          .addTo(state.map)
          .bindPopup('<strong>Minha Barraca</strong>');
      } else {
        state.mapMarkers.myTent.setLatLng([myTent.latitude, myTent.longitude]);
      }
    }
  }

  function updateMapMarkers() {
    if (!state.map) return;

    // Friends
    state.friends.forEach(f => {
      if (f.lat === null) return;
      let marker = state.mapMarkers.friends.get(f.id);
      if (!marker) {
        const icon = L.divIcon({
          className: 'custom-marker',
          html: `<div class="map-avatar">${f.nick.slice(0, 1).toUpperCase()}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        marker = L.marker([f.lat, f.lng], { icon })
          .addTo(state.map)
          .bindPopup(`<strong>${escapeHtml(f.nick)}</strong><br><button onclick="window.__aim('${f.id}')">SEGUIR</button>`);
        state.mapMarkers.friends.set(f.id, marker);
      } else {
        marker.setLatLng([f.lat, f.lng]);
      }
    });

    // All Tents
    state.allTents.forEach(t => {
      if (!t.lat || t.deviceId === state.deviceId) return;
      let marker = state.mapMarkers.tents.get(t.deviceId);
      if (!marker) {
        const icon = L.divIcon({
          className: 'tent-marker',
          html: '<div>⛺</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        marker = L.marker([t.lat, t.lng], { icon })
          .addTo(state.map)
          .bindPopup(`<strong>Barraca de ${escapeHtml(t.nick)}</strong><br><button onclick="window.__aimTent('${t.deviceId}')">IR PARA BARRACA</button>`);
        state.mapMarkers.tents.set(t.deviceId, marker);
      } else {
        marker.setLatLng([t.lat, t.lng]);
      }
    });
  }

  // Global helpers for popup buttons
  window.__aim = (userId) => {
    const friend = state.friends.find(f => f.id === userId);
    if (friend) {
      setTarget({
        type: 'user',
        id: friend.id,
        name: friend.nick,
        latitude: friend.lat,
        longitude: friend.lng
      });
      switchTab('radar');
    }
  };

  window.__aimTent = (deviceId) => {
    const tent = state.allTents.find(t => t.deviceId === deviceId);
    if (tent) {
      setTarget({
        type: 'tent',
        id: tent.deviceId,
        name: `Barraca de ${tent.nick}`,
        latitude: tent.lat,
        longitude: tent.lng
      });
      switchTab('radar');
    }
  };

  // Launch
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
