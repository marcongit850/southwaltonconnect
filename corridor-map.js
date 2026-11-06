(function () {
  var root = document.getElementById("corridor-map");
  if (!root || !window.L) return;

  var map = L.map(root, {
    scrollWheelZoom: false,
    zoomControl: true,
    attributionControl: true
  });

  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community. Roads: OpenStreetMap contributors.",
    maxZoom: 18
  }).addTo(map);
  map.setView([30.32, -86.16], 11);

  var layers = {
    connectors: L.layerGroup(),
    d2: L.layerGroup(),
    conservation: L.layerGroup()
  };

  function line(latlngs, color, weight, dash) {
    var group = L.layerGroup();
    L.polyline(latlngs, {
      color: "#06140f",
      weight: weight + 3,
      opacity: 0.72,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(group);
    L.polyline(latlngs, {
      color: color,
      weight: weight,
      opacity: 1,
      dashArray: dash || null,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(group);
    return group;
  }

  function tag(text, at, kind) {
    var wide = text.length > 18;
    var width = wide ? 150 : Math.max(54, Math.round(text.length * 7.4 + 16));
    var height = wide ? 34 : 22;
    var anchor = "center";
    if (text === "Destin" || text === "3.5 mi") anchor = "start";
    if (text === "Inlet Beach" || text === "1.8 mi" || text === "Watersound") anchor = "end";
    var ax = anchor === "start" ? 0 : anchor === "end" ? width : width / 2;
    return L.marker(at, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: "map-tag " + kind,
        html: text,
        iconSize: [width, height],
        iconAnchor: [ax, height / 2]
      })
    });
  }

  function draw(data) {
    data.us98.forEach(function (part) {
      line(part, "#2f7bff", 5).addTo(map);
    });
    data.scenic30a.forEach(function (part) {
      line(part, "#3dde6a", 5).addTo(map);
    });
    data.connectors.forEach(function (road) {
      line(road.line, "#ff9a1f", 4.5).addTo(layers.connectors);
    });
    data.d2.forEach(function (part) {
      line(part, "#ff3a2f", 4, "7 8").addTo(layers.d2);
    });
    data.conservation.forEach(function (area) {
      L.polygon(area.rings, {
        color: "#e7ffc4",
        weight: 1.25,
        opacity: 0.9,
        fillColor: "#1f9d4a",
        fillOpacity: 0.38
      }).addTo(layers.conservation);
    });

    data.miles.forEach(function (mile) {
      tag(mile.label, mile.at, "mile").addTo(map);
    });
    data.labels.forEach(function (item) {
      var host = map;
      if (item.kind === "connector") host = layers.connectors;
      else if (item.kind === "d2") host = layers.d2;
      else if (item.kind === "park") host = layers.conservation;
      tag(item.text, item.at, item.kind).addTo(host);
    });

    layers.connectors.addTo(map);
    layers.d2.addTo(map);
    layers.conservation.addTo(map);
    map.setMaxBounds(L.latLngBounds(data.bounds).pad(0.55));
    function frameMap() {
      map.invalidateSize();
      var narrow = window.matchMedia("(max-width: 700px)").matches;
      map.fitBounds(data.bounds, { padding: narrow ? [28, 22] : [18, 24] });
    }
    frameMap();
    window.setTimeout(frameMap, 200);
  }

  fetch("data/corridor-map.json")
    .then(function (response) {
      if (!response.ok) throw new Error("map data");
      return response.json();
    })
    .then(function (data) {
      draw(data);
      window.setTimeout(function () { map.invalidateSize(); }, 50);
    })
    .catch(function () {
      root.textContent = "The corridor map could not be loaded.";
    });

  document.querySelectorAll(".corridor-tools button").forEach(function (button) {
    button.addEventListener("click", function () {
      var on = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", on ? "true" : "false");
      var layer = layers[button.getAttribute("data-layer")];
      if (!layer) return;
      if (on) layer.addTo(map);
      else map.removeLayer(layer);
    });
  });

  window.addEventListener("resize", function () {
    map.invalidateSize();
  });
})();
