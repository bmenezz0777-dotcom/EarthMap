// ===================================================
// EARTHDANCE RADAR — MOTOR DEFINITIVO
// 100% Free · Zero API Keys · Sincronização Híbrida P2P + Gossip Vercel
// ===================================================

(function() {
  'use strict';

  // State
  const state = {
    deviceId: getOrCreateDeviceId(),
    nickname: localStorage.getItem('earthdance_nick') || '',
    myLocation: { lat: null, lng: null, accuracy: null, speed: null },
    lastLocation: null,
    heading: null,
    cog: null, // Course Over Ground (fallback)
    compassActive: false,
    myTent: getStoredTent(),
    friends: new Map(), // id -> friend
    allTents: new Map(), // deviceId -> tent
    target: null, // { type: 'mine'|'user'|'tent', id: string, name: string, lat: number, lng: number }
    map: null,
    mapMarkers: {
      me: null,
      myTent: null,
      friends: new Map(),
      tents: new Map()
    },
    peer: null,
    peerConnections: new Map(),
    syncTimer: null,
    lastAlignedVibrate: 0
  };

  // DOM Elements
  const dom = {
    setupModal: document.getElementById('setup-modal'),
    setupForm: document.getElementById('setup-form'),
    nickInput: document.getElementById('nick-input'),
    userDisplayNick: document.getElementById('user-display-nick'),
    btnQuickNick: document.getElementById('btn-quick-nick'),
    badgeSync: document.getElementById('badge-sync'),
    badgeGps: document.getElementById('badge-gps'),
    hudNickVal: document.getElementById('hud-nick-val'),
    hudGpsVal: document.getElementById('hud-gps-val'),
    hudCompassVal: document.getElementById('hud-compass-val'),
    targetName: document.getElementById('target-name'),
    targetTypeBadge: document.getElementById('target-type-badge'),
    targetDistance: document.getElementById('target-distance'),
    targetDirection: document.getElementById('target-direction'),
    targetAlignedAlert: document.getElementById('target-aligned-alert'),
    radarNeedle: document.getElementById('radar-needle'),
    btnFixTentGps: document.getElementById('btn-fix-tent-gps'),
    btnActivateCompass: document.getElementById('btn-activate-compass'),
    btnCompassText: document.getElementById('btn-compass-text'),
    btnStopTarget: document.getElementById('btn-stop-target'),
    myTentQuickCard: document.getElementById('my-tent-quick-card'),
    btnAimTentRadar: document.getElementById('btn-aim-tent-radar'),
    nearbyCountVal: document.getElementById('nearby-count-val'),
    nearbyChipsList: document.getElementById('nearby-chips-list'),
    btnSwitchToPeople: document.getElementById('btn-switch-to-people'),
    peopleCountHeader: document.getElementById('people-count-header'),
    peopleCardsList: document.getElementById('people-cards-list'),
    settingsNickHeader: document.getElementById('settings-nick-header'),
    settingsInputNick: document.getElementById('settings-input-nick'),
    btnSaveSettingsNick: document.getElementById('btn-save-settings-nick'),
    btnDiagGps: document.getElementById('btn-diag-gps'),
    btnDiagCompass: document.getElementById('btn-diag-compass'),
    btnDeleteTent: document.getElementById('btn-delete-tent'),
    btnMapRecenter: document.getElementById('btn-map-recenter'),
    btnMapTent: document.getElementById('btn-map-tent'),
    appToast: document.getElementById('app-toast'),
    toastMessage: document.getElementById('toast-message'),
    toastDismiss: document.getElementById('toast-dismiss'),
    navItems: document.querySelectorAll('.nav-item'),
    tabViews: {
      radar: document.getElementById('tab-radar-view'),
      map: document.getElementById('tab-map-view'),
      people: document.getElementById('tab-people-view'),
      settings: document.getElementById('tab-settings-view')
    }
  };

  // ===================================================
  // 1. BOOTSTRAP & IDENTIDADE
  // ===================================================
  function init() {
    registerServiceWorker();
    checkIdentity();
    setupNavigation();
    setupActions();
    startGps();
    initPeerJs();
    startServerlessSync();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.warn);
    }
  }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem('earthdance_device_id');
    if (!id) {
      id = 'ed_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('earthdance_device_id', id);
    }
    return id;
  }

  function getStoredTent() {
    try {
      const s = localStorage.getItem('earthdance_my_tent');
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  }

  function checkIdentity() {
    if (!state.nickname) {
      dom.setupModal.classList.remove('hidden');
    } else {
      updateNickDisplays(state.nickname);
    }

    dom.setupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = dom.nickInput.value.trim();
      const nick = val || 'Guerreiro #' + state.deviceId.slice(-4);
      saveNick(nick);
      dom.setupModal.classList.add('hidden');
    });

    dom.btnQuickNick.addEventListener('click', () => {
      dom.nickInput.value = state.nickname;
      dom.setupModal.classList.remove('hidden');
      dom.nickInput.focus();
    });

    if (state.myTent) {
      dom.myTentQuickCard.classList.remove('hidden');
      dom.btnDeleteTent.classList.remove('hidden');
    }
  }

  function saveNick(nick) {
    state.nickname = nick;
    localStorage.setItem('earthdance_nick', nick);
    updateNickDisplays(nick);
    syncServerless();
    showToast('Bem-vindo à Earthdance, ' + nick + '! 🌿');
  }

  function updateNickDisplays(nick) {
    dom.userDisplayNick.textContent = nick;
    dom.hudNickVal.textContent = nick;
    dom.settingsNickHeader.textContent = nick;
    dom.settingsInputNick.value = nick;
  }

  // ===================================================
  // 2. NAVEGAÇÃO POR ABAS
  // ===================================================
  function setupNavigation() {
    dom.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        switchTab(tab);
      });
    });

    dom.btnSwitchToPeople.addEventListener('click', () => switchTab('people'));
  }

  function switchTab(tabName) {
    dom.navItems.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    Object.keys(dom.tabViews).forEach(key => {
      dom.tabViews[key].classList.toggle('active', key === tabName);
    });

    if (tabName === 'map') {
      ensureLeafletMap();
    }
  }

  // ===================================================
  // 3. SENSORES: GPS E BÚSSOLA AUDITADOS
  // ===================================================
  function startGps() {
    if (!('geolocation' in navigator)) {
      dom.badgeGps.textContent = 'Sem GPS';
      dom.hudGpsVal.textContent = 'Indisponível';
      return;
    }

    navigator.geolocation.watchPosition(
      pos => {
        const prev = state.myLocation.lat ? { ...state.myLocation } : null;

        state.myLocation.lat = pos.coords.latitude;
        state.myLocation.lng = pos.coords.longitude;
        state.myLocation.accuracy = pos.coords.accuracy;
        state.myLocation.speed = pos.coords.speed;

        // Course over ground (COG) calculation when moving
        if (prev && pos.coords.speed && pos.coords.speed > 0.8) {
          state.cog = calculateBearing(prev.lat, prev.lng, pos.coords.latitude, pos.coords.longitude);
        }

        const acc = Math.round(pos.coords.accuracy);
        dom.badgeGps.textContent = `🛰️ GPS ±${acc}m`;
        dom.hudGpsVal.textContent = `±${acc}m`;

        updateRadarNavigation();
        updateMapSelf();
      },
      err => {
        console.warn('GPS Warning:', err);
        dom.badgeGps.textContent = '🛰️ GPS Inativo';
        dom.hudGpsVal.textContent = 'Sem Sinal';
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );
  }

  function activateCompass() {
    const onOrientation = (e) => {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') {
        // iOS Safari (True North)
        h = e.webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Android / Standard
        h = (360 - e.alpha) % 360;
      }

      if (h !== null) {
        state.heading = h;
        state.compassActive = true;
        dom.hudCompassVal.textContent = 'ATIVA';
        dom.btnCompassText.textContent = 'BÚSSOLA CALIBRADA E ATIVA';
        dom.btnActivateCompass.classList.add('active');
        updateRadarNavigation();
      }
    };

    // iOS 13+ requires explicit permission requested synchronously inside a click event
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(res => {
          if (res === 'granted') {
            window.addEventListener('deviceorientation', onOrientation, true);
            showToast('🧭 Bússola ativada com sucesso!');
          } else {
            showToast('Permissão de orientação foi negada.');
          }
        })
        .catch(err => {
          console.warn(err);
          showToast('Erro ao autorizar bússola.');
        });
    } else {
      // Android / Desktop
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', onOrientation, true);
      } else {
        window.addEventListener('deviceorientation', onOrientation, true);
      }
      showToast('🧭 Bússola ativada!');
    }
  }

  // ===================================================
  // 4. MATEMÁTICA GEODÉSICA: HAVERSINE & BEARING
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

  function formatDist(meters) {
    if (meters == null) return '-- m';
    if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
    return meters + ' m';
  }

  function updateRadarNavigation() {
    // Default to my tent if no target is active
    if (!state.target && state.myTent) {
      state.target = {
        type: 'mine',
        id: state.deviceId,
        name: 'Minha Barraca',
        lat: state.myTent.lat,
        lng: state.myTent.lng
      };
    }

    if (!state.target) {
      dom.targetName.textContent = 'Nenhum alvo selecionado';
      dom.targetTypeBadge.textContent = 'CAMP';
      dom.targetDistance.textContent = '-- m';
      dom.targetDirection.textContent = 'Selecione um guerreiro ou fixe sua barraca';
      dom.targetAlignedAlert.classList.add('hidden');
      dom.btnStopTarget.classList.add('hidden');
      return;
    }

    dom.btnStopTarget.classList.remove('hidden');
    dom.targetName.textContent = state.target.name;
    dom.targetTypeBadge.textContent = state.target.type === 'mine' ? 'MINHA BARRACA' : state.target.type === 'tent' ? 'BARRACA' : 'AMIGO';

    const { myLocation, target, heading, cog } = state;

    if (myLocation.lat === null || myLocation.lng === null) {
      dom.targetDistance.textContent = '...';
      dom.targetDirection.textContent = 'Aguardando GPS';
      return;
    }

    const dist = calculateDistance(myLocation.lat, myLocation.lng, target.lat, target.lng);
    dom.targetDistance.textContent = formatDist(dist);

    const bearing = calculateBearing(myLocation.lat, myLocation.lng, target.lat, target.lng);
    const activeHeading = heading != null ? heading : (cog != null ? cog : 0);
    const relativeAngle = (bearing - activeHeading + 360) % 360;

    dom.radarNeedle.style.transform = `rotate(${relativeAngle}deg)`;

    const diff = relativeAngle > 180 ? relativeAngle - 360 : relativeAngle;
    const absDiff = Math.abs(diff);

    if (heading != null || cog != null) {
      if (absDiff <= 12) {
        dom.targetDirection.textContent = '⬆ EM FRENTE';
        dom.targetAlignedAlert.classList.remove('hidden');

        // Haptic pulse when facing target directly (at most once every 5 seconds)
        const now = Date.now();
        if (now - state.lastAlignedVibrate > 5000) {
          state.lastAlignedVibrate = now;
          if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
        }
      } else {
        dom.targetAlignedAlert.classList.add('hidden');
        if (diff > 0) {
          dom.targetDirection.textContent = `↗ ${Math.round(absDiff)}° À DIREITA`;
        } else {
          dom.targetDirection.textContent = `↖ ${Math.round(absDiff)}° À ESQUERDA`;
        }
        if (absDiff > 135) {
          dom.targetDirection.textContent = '⬇ ATRÁS DE VOCÊ';
        }
      }
    } else {
      dom.targetDirection.textContent = `${Math.round(bearing)}° (Ative a bússola para virar)`;
    }
  }

  function setTarget(targetObj) {
    state.target = targetObj;
    updateRadarNavigation();
    renderNearbyChips();
    renderPeopleList();
  }

  // ===================================================
  // 5. REGISTRO DE BARRACA (DUPLO: GPS OU CLIQUE NO MAPA)
  // ===================================================
  function setupActions() {
    dom.btnActivateCompass.addEventListener('click', activateCompass);

    // 5.1. Fix Tent via current GPS
    dom.btnFixTentGps.addEventListener('click', () => {
      if (state.myLocation.lat === null) {
        alert('Aguardando sinal de GPS para fixar a barraca. Ative a localização no navegador!');
        return;
      }
      saveMyTentCoords(state.myLocation.lat, state.myLocation.lng, state.myLocation.accuracy || 5);
      showToast('🏕️ Barraca fixada nas suas coordenadas atuais!');
    });

    // 5.2. Aim Tent Radar Button
    dom.btnAimTentRadar.addEventListener('click', () => {
      if (!state.myTent) return;
      setTarget({
        type: 'mine',
        id: state.deviceId,
        name: 'Minha Barraca',
        lat: state.myTent.lat,
        lng: state.myTent.lng
      });
      switchTab('radar');
    });

    // 5.3. Stop following
    dom.btnStopTarget.addEventListener('click', () => {
      state.target = null;
      updateRadarNavigation();
      renderNearbyChips();
      renderPeopleList();
    });

    // Settings
    dom.btnSaveSettingsNick.addEventListener('click', () => {
      const v = dom.settingsInputNick.value.trim();
      if (v) saveNick(v);
    });

    dom.btnDiagGps.addEventListener('click', () => {
      startGps();
      showToast('Testando GPS...');
    });

    dom.btnDiagCompass.addEventListener('click', () => activateCompass());

    dom.btnDeleteTent.addEventListener('click', () => {
      if (confirm('Deseja realmente remover sua barraca?')) {
        state.myTent = null;
        localStorage.removeItem('earthdance_my_tent');
        dom.myTentQuickCard.classList.add('hidden');
        dom.btnDeleteTent.classList.add('hidden');
        if (state.target && state.target.type === 'mine') {
          state.target = null;
          updateRadarNavigation();
        }
        updateMapSelf();
        showToast('Barraca removida.');
      }
    });

    // Map Quick Tools
    dom.btnMapRecenter.addEventListener('click', () => {
      if (state.map && state.myLocation.lat !== null) {
        state.map.setView([state.myLocation.lat, state.myLocation.lng], 17);
      }
    });

    dom.btnMapTent.addEventListener('click', () => {
      if (state.map && state.myTent) {
        state.map.setView([state.myTent.lat, state.myTent.lng], 17);
      } else {
        showToast('Você ainda não fixou sua barraca.');
      }
    });

    dom.toastDismiss.addEventListener('click', () => {
      dom.appToast.classList.add('hidden');
    });
  }

  function saveMyTentCoords(lat, lng, acc) {
    const tentData = {
      lat,
      lng,
      accuracy: acc || 5,
      savedAt: Date.now()
    };

    state.myTent = tentData;
    localStorage.setItem('earthdance_my_tent', JSON.stringify(tentData));

    dom.myTentQuickCard.classList.remove('hidden');
    dom.btnDeleteTent.classList.remove('hidden');

    if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);

    setTarget({
      type: 'mine',
      id: state.deviceId,
      name: 'Minha Barraca',
      lat: tentData.lat,
      lng: tentData.lng
    });

    // Send to Vercel API immediately
    fetch('/api/tent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: state.deviceId,
        nick: state.nickname || 'Minha Barraca',
        lat: tentData.lat,
        lng: tentData.lng,
        accuracy: tentData.accuracy
      })
    }).catch(console.warn);

    // Broadcast via WebRTC P2P to nearby peers
    broadcastP2P({
      type: 'TENT_UPDATE',
      deviceId: state.deviceId,
      nick: state.nickname,
      tent: tentData
    });

    updateMapSelf();
  }

  function showToast(text) {
    dom.toastMessage.textContent = text;
    dom.appToast.classList.remove('hidden');
    setTimeout(() => {
      dom.appToast.classList.add('hidden');
    }, 4000);
  }

  // ===================================================
  // 6. SINCRONIZAÇÃO HÍBRIDA (WebRTC P2P + Gossip Vercel)
  // ===================================================
  function initPeerJs() {
    if (typeof Peer === 'undefined') return;

    try {
      // Direct WebRTC connection with room identifier
      const peer = new Peer('ed_tribe_' + state.deviceId, {
        debug: 0
      });

      peer.on('open', () => {
        state.peer = peer;
        dom.badgeSync.textContent = '🟢 P2P + Vercel';
        dom.badgeSync.className = 'status-pill status-online';
      });

      peer.on('connection', conn => {
        conn.on('data', data => handleP2PData(data));
      });

      peer.on('error', () => {
        // Silent fallback to Vercel serverless
      });
    } catch (e) {
      console.warn('PeerJS fallback to serverless:', e);
    }
  }

  function broadcastP2P(msg) {
    state.peerConnections.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  }

  function handleP2PData(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === 'PEER_PING' && msg.user) {
      state.friends.set(msg.user.id, msg.user);
      renderNearbyChips();
      renderPeopleList();
      updateMapMarkers();
    } else if (msg.type === 'TENT_UPDATE' && msg.tent) {
      state.allTents.set(msg.deviceId, {
        deviceId: msg.deviceId,
        nick: msg.nick,
        ...msg.tent
      });
      updateMapMarkers();
    }
  }

  function startServerlessSync() {
    syncServerless();
    state.syncTimer = setInterval(syncServerless, 4000);
  }

  async function syncServerless() {
    try {
      // Gossip payload: includes cached friends and tents so any container gets full state
      const knownPeers = Array.from(state.friends.values()).slice(0, 30);
      const knownTents = Array.from(state.allTents.values()).slice(0, 30);

      const payload = {
        deviceId: state.deviceId,
        nick: state.nickname || 'Guerreiro da Paz',
        lat: state.myLocation.lat,
        lng: state.myLocation.lng,
        accuracy: state.myLocation.accuracy,
        heading: state.heading,
        tent: state.myTent,
        knownPeers,
        knownTents
      };

      const res = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Status ' + res.status);
      const data = await res.json();

      dom.badgeSync.className = 'status-pill status-online';
      dom.badgeSync.textContent = '🟢 Online';

      if (Array.isArray(data.friends)) {
        data.friends.forEach(f => state.friends.set(f.id, f));
      }

      if (Array.isArray(data.allTents)) {
        data.allTents.forEach(t => state.allTents.set(t.deviceId, t));
      }

      renderNearbyChips();
      renderPeopleList();
      updateMapMarkers();

    } catch (err) {
      dom.badgeSync.className = 'status-pill status-connecting';
      dom.badgeSync.textContent = '🟠 Instável';
    }
  }

  // ===================================================
  // 7. RENDERIZAÇÃO DE LISTAS E CHIPS
  // ===================================================
  function renderNearbyChips() {
    dom.nearbyChipsList.innerHTML = '';
    const friendsList = Array.from(state.friends.values());
    dom.nearbyCountVal.textContent = friendsList.length;

    if (friendsList.length === 0) {
      dom.nearbyChipsList.innerHTML = '<div class="chips-empty">Nenhum guerreiro por perto ainda...</div>';
      return;
    }

    const sorted = friendsList.map(f => {
      let d = null;
      if (state.myLocation.lat !== null && f.lat !== null) {
        d = calculateDistance(state.myLocation.lat, state.myLocation.lng, f.lat, f.lng);
      }
      return { ...f, dist: d };
    }).sort((a, b) => (a.dist || 99999) - (b.dist || 99999));

    sorted.slice(0, 6).forEach(f => {
      const isTarget = state.target && state.target.id === f.id;
      const chip = document.createElement('button');
      chip.className = 'chip-item';
      chip.style.borderColor = isTarget ? 'var(--color-green)' : 'var(--border-line)';
      chip.innerHTML = `
        <span class="chip-avatar">${f.nick.slice(0, 1).toUpperCase()}</span>
        <span class="chip-name">${escapeHtml(f.nick)}</span>
        <span class="chip-dist">${formatDist(f.dist)}</span>
      `;
      chip.addEventListener('click', () => {
        if (f.lat === null) {
          showToast(f.nick + ' ainda não tem sinal GPS.');
          return;
        }
        setTarget({
          type: 'user',
          id: f.id,
          name: f.nick,
          lat: f.lat,
          lng: f.lng
        });
        if ('vibrate' in navigator) navigator.vibrate(30);
      });
      dom.nearbyChipsList.appendChild(chip);
    });
  }

  function renderPeopleList() {
    dom.peopleCardsList.innerHTML = '';
    const friendsList = Array.from(state.friends.values());
    dom.peopleCountHeader.textContent = friendsList.length;

    if (friendsList.length === 0) {
      dom.peopleCardsList.innerHTML = `
        <div class="empty-state">
          Ninguém apareceu ainda.<br>
          Compartilhe o link com seus amigos da rave para eles aparecerem aqui!
        </div>
      `;
      return;
    }

    friendsList.forEach(f => {
      let d = null;
      if (state.myLocation.lat !== null && f.lat !== null) {
        d = calculateDistance(state.myLocation.lat, state.myLocation.lng, f.lat, f.lng);
      }

      const isTarget = state.target && state.target.id === f.id;
      const row = document.createElement('div');
      row.className = `person-row-card ${isTarget ? 'active-target' : ''}`;
      row.innerHTML = `
        <div class="person-row-avatar">${f.nick.slice(0, 1).toUpperCase()}</div>
        <div class="person-row-details">
          <strong>${escapeHtml(f.nick)}</strong>
          <small>● ONLINE ${f.accuracy ? `· GPS ±${Math.round(f.accuracy)}m` : ''}</small>
        </div>
        <div class="person-row-dist">${formatDist(d)}</div>
      `;

      row.addEventListener('click', () => {
        if (f.lat === null) {
          showToast(f.nick + ' não enviou GPS.');
          return;
        }
        setTarget({
          type: 'user',
          id: f.id,
          name: f.nick,
          lat: f.lat,
          lng: f.lng
        });
        if ('vibrate' in navigator) navigator.vibrate(30);
        switchTab('radar');
      });

      dom.peopleCardsList.appendChild(row);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
  }

  // ===================================================
  // 8. MAPA 100% FREE (OpenStreetMap + Leaflet)
  // ===================================================
  function ensureLeafletMap() {
    if (state.map) {
      state.map.invalidateSize();
      return;
    }

    if (typeof L === 'undefined') return;

    const initialLat = state.myLocation.lat || -23.55052;
    const initialLng = state.myLocation.lng || -46.633308;

    state.map = L.map('map-canvas', {
      zoomControl: false,
      attributionControl: true
    }).setView([initialLat, initialLng], 17);

    // 100% Free OpenStreetMap Public Tiles (NO API KEY EVER)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(state.map);

    // Allow user to tap ANYWHERE on the map to set their tent location!
    state.map.on('click', e => {
      const { lat, lng } = e.latlng;
      const popupContent = document.createElement('div');
      popupContent.innerHTML = `
        <strong>Marcar Minha Barraca Aqui?</strong><br>
        <button id="btn-popup-set-tent">SIM, FIXAR NESTE PONTO 🏕️</button>
      `;
      popupContent.querySelector('#btn-popup-set-tent').addEventListener('click', () => {
        saveMyTentCoords(lat, lng, 3);
        state.map.closePopup();
        showToast('🏕️ Barraca marcada no ponto selecionado do mapa!');
      });

      L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(state.map);
    });

    updateMapSelf();
    updateMapMarkers();
  }

  function updateMapSelf() {
    if (!state.map) return;
    const { myLocation, myTent } = state;

    if (myLocation.lat !== null) {
      if (!state.mapMarkers.me) {
        state.mapMarkers.me = L.circleMarker([myLocation.lat, myLocation.lng], {
          radius: 9,
          color: '#00ff9d',
          fillColor: '#00ff9d',
          fillOpacity: 0.95
        }).addTo(state.map).bindPopup('<strong>Você está aqui</strong>');
      } else {
        state.mapMarkers.me.setLatLng([myLocation.lat, myLocation.lng]);
      }
    }

    if (myTent && myTent.lat) {
      if (!state.mapMarkers.myTent) {
        const tentIcon = L.divIcon({
          className: 'tent-marker',
          html: '<div style="font-size:28px; filter:drop-shadow(0 0 8px #f59e0b);">🏕️</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        state.mapMarkers.myTent = L.marker([myTent.lat, myTent.lng], { icon: tentIcon })
          .addTo(state.map)
          .bindPopup('<strong>Minha Barraca</strong>');
      } else {
        state.mapMarkers.myTent.setLatLng([myTent.lat, myTent.lng]);
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
          html: `<div style="background:#07110d; border:2px solid #00ff9d; box-shadow:0 0 12px #00ff9d; border-radius:50%; width:34px; height:34px; display:grid; place-items:center; color:#fff; font-weight:900; font-size:12px;">${f.nick.slice(0, 1).toUpperCase()}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        marker = L.marker([f.lat, f.lng], { icon })
          .addTo(state.map)
          .bindPopup(`<strong>${escapeHtml(f.nick)}</strong><br><button onclick="window.__aim('${f.id}')">SEGUIR COM A SETA</button>`);
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
          html: '<div style="font-size:24px; filter:drop-shadow(0 0 6px #fbbf24);">⛺</div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
        marker = L.marker([t.lat, t.lng], { icon })
          .addTo(state.map)
          .bindPopup(`<strong>Barraca de ${escapeHtml(t.nick)}</strong><br><button onclick="window.__aimTent('${t.deviceId}')">IR PARA ESTA BARRACA</button>`);
        state.mapMarkers.tents.set(t.deviceId, marker);
      } else {
        marker.setLatLng([t.lat, t.lng]);
      }
    });
  }

  // Global popup helpers
  window.__aim = (userId) => {
    const f = state.friends.get(userId);
    if (f) {
      setTarget({
        type: 'user',
        id: f.id,
        name: f.nick,
        lat: f.lat,
        lng: f.lng
      });
      switchTab('radar');
    }
  };

  window.__aimTent = (deviceId) => {
    const t = state.allTents.get(deviceId);
    if (t) {
      setTarget({
        type: 'tent',
        id: t.deviceId,
        name: `Barraca de ${t.nick}`,
        lat: t.lat,
        lng: t.lng
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
