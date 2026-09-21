// ===================================================
// EARTHDANCE RADAR — CLIENT CONTROLLER
// 100% Vercel Serverless Ready · Zero Login · High Precision
// ===================================================

(function() {
  'use strict';

  // State
  const state = {
    deviceId: getOrCreateDeviceId(),
    nick: localStorage.getItem('earthdance_nick') || '',
    clientIp: '...',
    myLocation: { lat: null, lng: null, accuracy: null, speed: null },
    deviceHeading: 0,
    hasCompass: false,
    myTent: getStoredTent(),
    friends: [],
    allTents: [],
    currentTarget: null, // { type: 'tent'|'friend', id: string, name: string, lat: number, lng: number }
    map: null,
    mapMarkers: {
      me: null,
      myTent: null,
      friends: new Map(),
      tents: new Map()
    },
    syncTimer: null,
    isOffline: false
  };

  // DOM Elements
  const dom = {
    nickModal: document.getElementById('nick-modal'),
    nickInput: document.getElementById('nick-input'),
    btnSaveNick: document.getElementById('btn-save-nick'),
    btnEditNick: document.getElementById('btn-edit-nick'),
    headerUserNick: document.getElementById('header-user-nick'),
    badgeOnline: document.getElementById('badge-online'),
    badgeGps: document.getElementById('badge-gps'),
    badgeIp: document.getElementById('badge-ip'),
    tabRadar: document.getElementById('tab-radar'),
    tabMap: document.getElementById('tab-map'),
    viewRadar: document.getElementById('view-radar'),
    viewMap: document.getElementById('view-map'),
    targetName: document.getElementById('target-name'),
    targetTypeBadge: document.getElementById('target-type-badge'),
    targetDistance: document.getElementById('target-distance'),
    targetDirectionText: document.getElementById('target-direction-text'),
    targetLockedAlert: document.getElementById('target-locked-alert'),
    radarNeedle: document.getElementById('radar-needle'),
    btnFixTent: document.getElementById('btn-fix-tent'),
    btnAimTent: document.getElementById('btn-aim-tent'),
    tribeList: document.getElementById('tribe-list'),
    tribeCount: document.getElementById('tribe-count'),
    offlineBanner: document.getElementById('offline-banner'),
    btnRecenterMap: document.getElementById('btn-recenter-map'),
    btnMapMyTent: document.getElementById('btn-map-my-tent')
  };

  // ===================================================
  // 1. INITIALIZATION & IDENTITY
  // ===================================================
  function init() {
    setupNick();
    setupTabs();
    setupActions();
    initSensors();
    initSync();
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
      const stored = localStorage.getItem('earthdance_my_tent');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  function setupNick() {
    if (!state.nick) {
      // Prompt modal smoothly
      dom.nickModal.classList.remove('hidden');
    } else {
      dom.headerUserNick.textContent = state.nick;
    }

    dom.btnSaveNick.addEventListener('click', saveNick);
    dom.nickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveNick();
    });

    dom.btnEditNick.addEventListener('click', () => {
      dom.nickInput.value = state.nick || '';
      dom.nickModal.classList.remove('hidden');
      dom.nickInput.focus();
    });
  }

  function saveNick() {
    const val = dom.nickInput.value.trim();
    const finalNick = val || 'Guerreiro #' + state.deviceId.slice(-4);
    state.nick = finalNick;
    localStorage.setItem('earthdance_nick', finalNick);
    dom.headerUserNick.textContent = finalNick;
    dom.nickModal.classList.add('hidden');
    syncWithServer(); // Immediate update to backend
  }

  // ===================================================
  // 2. TABS & VIEW SWITCHING
  // ===================================================
  function setupTabs() {
    dom.tabRadar.addEventListener('click', () => {
      dom.tabRadar.classList.add('active');
      dom.tabMap.classList.remove('active');
      dom.viewRadar.classList.add('active');
      dom.viewMap.classList.remove('active');
    });

    dom.tabMap.addEventListener('click', () => {
      dom.tabMap.classList.add('active');
      dom.tabRadar.classList.remove('active');
      dom.viewMap.classList.add('active');
      dom.viewRadar.classList.remove('active');
      ensureMapInitialized();
    });
  }

  // ===================================================
  // 3. SENSORS: GPS & COMPASS HEADING
  // ===================================================
  function initSensors() {
    // 3.1. GPS Tracking
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => {
          state.myLocation.lat = pos.coords.latitude;
          state.myLocation.lng = pos.coords.longitude;
          state.myLocation.accuracy = pos.coords.accuracy;
          state.myLocation.speed = pos.coords.speed;

          const accMeters = Math.round(pos.coords.accuracy);
          dom.badgeGps.textContent = `🛰️ GPS ±${accMeters}m`;
          dom.badgeGps.classList.add('badge-pulse');

          updateNavigationHUD();
          updateMapSelf();
        },
        (err) => {
          console.warn('GPS Warning:', err);
          dom.badgeGps.textContent = '🛰️ GPS Inativo';
          dom.badgeGps.classList.remove('badge-pulse');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000
        }
      );
    } else {
      dom.badgeGps.textContent = '🛰️ Sem GPS';
    }

    // 3.2. Compass & Device Orientation
    const handleOrientation = (event) => {
      let heading = null;
      if (typeof event.webkitCompassHeading === 'number') {
        // iOS
        heading = event.webkitCompassHeading;
      } else if (event.alpha !== null) {
        // Android / standard (compass heading approximate)
        heading = (360 - event.alpha) % 360;
      }

      if (heading !== null) {
        state.deviceHeading = heading;
        state.hasCompass = true;
        updateNavigationHUD();
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    // iOS 13+ Permission request on first user interaction
    const requestOrientationPermission = () => {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then((res) => {
            if (res === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, true);
            }
          })
          .catch(console.warn);
      }
      document.removeEventListener('click', requestOrientationPermission);
      document.removeEventListener('touchstart', requestOrientationPermission);
    };
    document.addEventListener('click', requestOrientationPermission, { once: true });
    document.addEventListener('touchstart', requestOrientationPermission, { once: true });
  }

  // ===================================================
  // 4. NAVIGATION MATHEMATICS (Haversine & Azimuth)
  // ===================================================
  function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
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

  function calculateBearingDegrees(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return bearing;
  }

  function updateNavigationHUD() {
    // If no target is set, default to my tent if available
    if (!state.currentTarget && state.myTent) {
      setTarget({
        type: 'tent',
        id: state.deviceId,
        name: 'Minha Barraca',
        lat: state.myTent.lat,
        lng: state.myTent.lng
      });
    }

    if (!state.currentTarget) {
      dom.targetName.textContent = 'Nenhum alvo selecionado';
      dom.targetTypeBadge.textContent = '🧭 AGUARDANDO';
      dom.targetDistance.textContent = '-- m';
      dom.targetDirectionText.textContent = 'Selecione um amigo ou fixe sua barraca';
      dom.targetLockedAlert.classList.add('hidden');
      return;
    }

    const { myLocation, currentTarget, deviceHeading } = state;

    if (myLocation.lat === null || myLocation.lng === null) {
      dom.targetDistance.textContent = 'Localizando...';
      dom.targetDirectionText.textContent = 'Aguardando GPS';
      return;
    }

    // 1. Distance
    const distanceMeters = calculateDistanceMeters(
      myLocation.lat, myLocation.lng,
      currentTarget.lat, currentTarget.lng
    );

    if (distanceMeters >= 1000) {
      dom.targetDistance.textContent = (distanceMeters / 1000).toFixed(1) + ' km';
    } else {
      dom.targetDistance.textContent = distanceMeters + ' m';
    }

    // 2. Direction & Needle Angle
    const targetBearing = calculateBearingDegrees(
      myLocation.lat, myLocation.lng,
      currentTarget.lat, currentTarget.lng
    );

    // Relative angle between target bearing and device compass heading
    const relativeAngle = (targetBearing - deviceHeading + 360) % 360;

    // Rotate needle smoothly
    dom.radarNeedle.style.transform = `rotate(${relativeAngle}deg)`;

    // Directional Text
    let dirText = '';
    const diff = relativeAngle > 180 ? relativeAngle - 360 : relativeAngle;
    const absDiff = Math.abs(diff);

    if (absDiff <= 12) {
      dirText = '⬆ EM FRENTE';
      dom.targetLockedAlert.classList.remove('hidden');
    } else {
      dom.targetLockedAlert.classList.add('hidden');
      if (diff > 0) {
        dirText = `↗ ${Math.round(absDiff)}° À DIREITA`;
      } else {
        dirText = `↖ ${Math.round(absDiff)}° À ESQUERDA`;
      }
      if (absDiff > 135) {
        dirText = '⬇ ATRÁS DE VOCÊ';
      }
    }

    dom.targetDirectionText.textContent = dirText;
  }

  function setTarget(target) {
    state.currentTarget = target;
    dom.targetName.textContent = target.name;
    dom.targetTypeBadge.textContent = target.type === 'tent' ? '🏕️ BARRACA' : '👤 GUERREIRO';
    updateNavigationHUD();
    renderTribeList();
  }

  // ===================================================
  // 5. BARRACA (TENT) REGISTRATION & TARGETING
  // ===================================================
  function setupActions() {
    // 5.1. Button: FIXAR MINHA BARRACA AQUI
    dom.btnFixTent.addEventListener('click', () => {
      if (state.myLocation.lat === null || state.myLocation.lng === null) {
        alert('⚠️ Aguardando sinal de GPS do seu celular para registrar a barraca! Permita a localização se solicitado.');
        return;
      }

      const tentData = {
        lat: state.myLocation.lat,
        lng: state.myLocation.lng,
        accuracy: state.myLocation.accuracy || 5,
        savedAt: Date.now()
      };

      state.myTent = tentData;
      localStorage.setItem('earthdance_my_tent', JSON.stringify(tentData));

      // Haptic feedback if supported
      if ('vibrate' in navigator) navigator.vibrate([80, 50, 80]);

      // Set target immediately to my tent
      setTarget({
        type: 'tent',
        id: state.deviceId,
        name: 'Minha Barraca',
        lat: tentData.lat,
        lng: tentData.lng
      });

      // Send to Vercel API
      fetch('/api/tent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: state.deviceId,
          nick: state.nick || 'Meu Acampamento',
          lat: tentData.lat,
          lng: tentData.lng,
          accuracy: tentData.accuracy
        })
      })
      .then(res => res.json())
      .catch(err => console.warn('Offline tent save; will sync on next ping:', err));

      alert('🏕️ BARRACA REGISTRADA COM SUCESSO!\nSua barraca foi salva e a bússola já está configurada para ela.');
      updateMapSelf();
    });

    // 5.2. Button: VOLTAR PARA MINHA BARRACA
    dom.btnAimTent.addEventListener('click', () => {
      if (!state.myTent) {
        alert('Você ainda não registrou sua barraca! Clique em "FIXAR MINHA BARRACA AQUI" quando estiver nela.');
        return;
      }

      setTarget({
        type: 'tent',
        id: state.deviceId,
        name: 'Minha Barraca',
        lat: state.myTent.lat,
        lng: state.myTent.lng
      });

      if ('vibrate' in navigator) navigator.vibrate(50);
    });

    // Map tools
    dom.btnRecenterMap.addEventListener('click', () => {
      if (state.map && state.myLocation.lat !== null) {
        state.map.setView([state.myLocation.lat, state.myLocation.lng], 18);
      }
    });

    dom.btnMapMyTent.addEventListener('click', () => {
      if (state.map && state.myTent) {
        state.map.setView([state.myTent.lat, state.myTent.lng], 18);
      } else {
        alert('Você ainda não salvou sua barraca.');
      }
    });
  }

  // ===================================================
  // 6. SYNCHRONIZATION WITH VERCEL SERVERLESS API
  // ===================================================
  function initSync() {
    syncWithServer();
    state.syncTimer = setInterval(syncWithServer, 4000);
  }

  async function syncWithServer() {
    try {
      const payload = {
        deviceId: state.deviceId,
        nick: state.nick || 'Guerreiro da Paz',
        lat: state.myLocation.lat,
        lng: state.myLocation.lng,
        accuracy: state.myLocation.accuracy,
        heading: state.deviceHeading,
        tent: state.myTent
      };

      const res = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();

      // Successful sync
      state.isOffline = false;
      dom.offlineBanner.classList.add('hidden');
      dom.badgeOnline.textContent = '🟢 Online';
      dom.badgeOnline.classList.add('badge-pulse');

      if (data.clientIp) {
        state.clientIp = data.clientIp;
        dom.badgeIp.textContent = 'IP: ' + data.clientIp;
      }

      if (Array.isArray(data.friends)) {
        state.friends = data.friends;
        dom.tribeCount.textContent = data.friends.length;
      }

      if (Array.isArray(data.allTents)) {
        state.allTents = data.allTents;
      }

      renderTribeList();
      updateMapMarkers();

    } catch (err) {
      console.warn('Sync error (operating offline):', err);
      state.isOffline = true;
      dom.offlineBanner.classList.remove('hidden');
      dom.badgeOnline.textContent = '🟠 Offline';
      dom.badgeOnline.classList.remove('badge-pulse');
    }
  }

  // ===================================================
  // 7. TRIBE LIST RENDERING
  // ===================================================
  function renderTribeList() {
    dom.tribeList.innerHTML = '';

    if (state.friends.length === 0) {
      dom.tribeList.innerHTML = `
        <div class="tribe-empty-state">
          <p>Nenhum outro guerreiro online no momento.<br>Compartilhe o link com seus amigos da rave!</p>
        </div>
      `;
      return;
    }

    state.friends.forEach(friend => {
      let distStr = '-- m';
      if (state.myLocation.lat !== null && friend.lat !== null) {
        const d = calculateDistanceMeters(state.myLocation.lat, state.myLocation.lng, friend.lat, friend.lng);
        distStr = d >= 1000 ? (d / 1000).toFixed(1) + ' km' : d + ' m';
      }

      const isTarget = state.currentTarget && state.currentTarget.id === friend.id;

      const card = document.createElement('div');
      card.className = `tribe-card ${isTarget ? 'is-active-target' : ''}`;
      card.innerHTML = `
        <div class="tribe-user-info">
          <span class="tribe-avatar">👤</span>
          <div>
            <div class="tribe-user-name">${escapeHtml(friend.nick)}</div>
            <div class="tribe-user-meta">Distância: <strong>${distStr}</strong> · IP: ${escapeHtml(friend.ip || '...')}</div>
          </div>
        </div>
        <div class="tribe-card-actions">
          <button class="btn-tribe-target" data-id="${friend.id}">🎯 SEGUIR</button>
          ${friend.tent ? `<button class="btn-tribe-tent" data-id="${friend.id}">🏕️ BARRACA</button>` : ''}
        </div>
      `;

      card.querySelector('.btn-tribe-target').addEventListener('click', () => {
        if (friend.lat === null || friend.lng === null) {
          alert(`O GPS de ${friend.nick} ainda não enviou coordenadas.`);
          return;
        }
        setTarget({
          type: 'friend',
          id: friend.id,
          name: friend.nick,
          lat: friend.lat,
          lng: friend.lng
        });
        if ('vibrate' in navigator) navigator.vibrate(40);
        // Switch back to radar tab smoothly
        dom.tabRadar.click();
      });

      const tentBtn = card.querySelector('.btn-tribe-tent');
      if (tentBtn && friend.tent) {
        tentBtn.addEventListener('click', () => {
          setTarget({
            type: 'tent',
            id: 'tent_' + friend.id,
            name: `Barraca de ${friend.nick}`,
            lat: friend.tent.lat,
            lng: friend.tent.lng
          });
          if ('vibrate' in navigator) navigator.vibrate(40);
          dom.tabRadar.click();
        });
      }

      dom.tribeList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  // ===================================================
  // 8. LEAFLET TACTICAL MAP
  // ===================================================
  function ensureMapInitialized() {
    if (state.map) {
      state.map.invalidateSize();
      return;
    }

    if (typeof L === 'undefined') return;

    const initialLat = state.myLocation.lat || -23.55052;
    const initialLng = state.myLocation.lng || -46.633308;

    state.map = L.map('leaflet-map', {
      zoomControl: true,
      attributionControl: false
    }).setView([initialLat, initialLng], 17);

    // Dark Psytrance Tile Layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(state.map);

    updateMapSelf();
    updateMapMarkers();
  }

  function updateMapSelf() {
    if (!state.map) return;
    const { myLocation, myTent } = state;

    if (myLocation.lat !== null) {
      if (!state.mapMarkers.me) {
        const myIcon = L.divIcon({
          className: 'map-marker-me',
          html: '<div style="background:#00ff9d; width:16px; height:16px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 12px #00ff9d;"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        state.mapMarkers.me = L.marker([myLocation.lat, myLocation.lng], { icon: myIcon })
          .addTo(state.map)
          .bindPopup('<strong>Você está aqui</strong>');
      } else {
        state.mapMarkers.me.setLatLng([myLocation.lat, myLocation.lng]);
      }
    }

    if (myTent && myTent.lat) {
      if (!state.mapMarkers.myTent) {
        const tentIcon = L.divIcon({
          className: 'map-marker-tent',
          html: '<div style="font-size:24px; filter:drop-shadow(0 0 8px #f59e0b);">🏕️</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
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

    // Friends markers
    state.friends.forEach(friend => {
      if (friend.lat === null) return;
      let marker = state.mapMarkers.friends.get(friend.id);
      if (!marker) {
        const icon = L.divIcon({
          className: 'map-marker-friend',
          html: '<div style="background:#8b5cf6; width:14px; height:14px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px #8b5cf6;"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        marker = L.marker([friend.lat, friend.lng], { icon })
          .addTo(state.map)
          .bindPopup(`<strong>${escapeHtml(friend.nick)}</strong>`);
        state.mapMarkers.friends.set(friend.id, marker);
      } else {
        marker.setLatLng([friend.lat, friend.lng]);
      }
    });

    // All registered tents
    state.allTents.forEach(tent => {
      if (!tent.lat || tent.deviceId === state.deviceId) return;
      let marker = state.mapMarkers.tents.get(tent.deviceId);
      if (!marker) {
        const icon = L.divIcon({
          className: 'map-marker-tent-other',
          html: '<div style="font-size:20px; filter:drop-shadow(0 0 6px #fbbf24);">⛺</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        marker = L.marker([tent.lat, tent.lng], { icon })
          .addTo(state.map)
          .bindPopup(`<strong>Barraca de ${escapeHtml(tent.nick)}</strong>`);
        state.mapMarkers.tents.set(tent.deviceId, marker);
      } else {
        marker.setLatLng([tent.lat, tent.lng]);
      }
    });
  }

  // Start app on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
