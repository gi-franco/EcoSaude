
(() => {
  "use strict";

  const mapContainer = document.getElementById("map");

  let map = null;
  let referenceMarker = null;
  const ecopointMarkers = new Map();

  function getCoordinates(point) {
    const lat = Number(point.latitude ?? point.lat);
    const lon = Number(point.longitude ?? point.lon ?? point.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180 ||
      point.latitude === null ||
      point.lat === null ||
      point.longitude === null ||
      point.lon === null
    ) {
      return null;
    }

    return { lat, lon };
  }

  function createPopup(point) {
    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = point.nome || "Ecoponto";
    content.appendChild(title);

    const address = document.createElement("p");
    address.textContent = point.endereco || "Endereço não informado.";
    content.appendChild(address);

    const municipality = document.createElement("p");
    municipality.textContent = point.municipio || "";
    content.appendChild(municipality);

    if (point.fonte) {
      const link = document.createElement("a");
      link.href = point.fonte;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Consultar fonte oficial";
      content.appendChild(link);
    }

    return content;
  }

  function init() {
    if (!mapContainer) {
      console.warn('O elemento com id "map" não foi encontrado.');
      return;
    }

    if (!window.L) {
      mapContainer.textContent =
        "O mapa não foi carregado. Verifique sua conexão com a internet.";
      return;
    }

    if (map) return;

    map = L.map(mapContainer).setView([-23.54, -46.31], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
  }

  function showReference(coords) {
    init();
    if (!map || !coords) return;

    const lat = Number(coords.lat);
    const lon = Number(coords.lon ?? coords.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    if (referenceMarker) {
      map.removeLayer(referenceMarker);
    }

    referenceMarker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup("Endereço pesquisado");

    referenceMarker.openPopup();
    map.setView([lat, lon], 12);
  }

  function addEcopoint(point) {
    init();
    if (!map || !point) return;

    const coords = getCoordinates(point);
    if (!coords) return;

    const id = String(
      point.id || `${point.nome || "ecoponto"}-${coords.lat}-${coords.lon}`
    );

    if (ecopointMarkers.has(id)) {
      map.removeLayer(ecopointMarkers.get(id));
    }

    const marker = L.marker([coords.lat, coords.lon])
      .addTo(map)
      .bindPopup(createPopup(point));

    ecopointMarkers.set(id, marker);
  }

  function focusPoint(point) {
    init();
    if (!map || !point) return;

    const coords = getCoordinates(point);
    if (!coords) return;

    map.setView([coords.lat, coords.lon], 15);

    const id = String(
      point.id || `${point.nome || "ecoponto"}-${coords.lat}-${coords.lon}`
    );

    const marker = ecopointMarkers.get(id);
    if (marker) marker.openPopup();
  }

  function refresh() {
    if (!map) init();
    if (!map) return;

    ecopointMarkers.forEach((marker) => map.removeLayer(marker));
    ecopointMarkers.clear();
  }

  document.addEventListener("DOMContentLoaded", init);
  init();

  window.EcoSaudeMap = {
    init,
    showReference,
    addEcopoint,
    focusPoint,
    refresh
  };
})();