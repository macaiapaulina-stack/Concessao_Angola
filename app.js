// Inicializa o mapa centrado em Angola
const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
}).setView([-11.2027, 17.8739], 6);

// Panes para controlar ordem de desenho (z-index)
map.createPane('paneConcessao');
map.getPane('paneConcessao').style.zIndex = 400; // abaixo dos pontos
map.createPane('panePocos');
map.getPane('panePocos').style.zIndex = 650; // acima dos polígonos

// Camada base OpenStreetMap
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contribuidores'
});
// Base adicionais
const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap, &copy; CARTO'
});
const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    attribution: 'Tiles &copy; Esri'
});
const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    attribution: 'Tiles &copy; Esri'
});
osm.addTo(map);

// Controle de escala (opcional)
L.control.scale({ metric: true, imperial: false }).addTo(map);

// Função utilitária para criar popup genérico a partir das propriedades
function buildPopupContent(properties) {
    if (!properties) return 'Sem atributos';
    const rows = Object.entries(properties)
        .map(([k, v]) => `<tr><th style="text-align:left;padding-right:8px;">${k}</th><td>${v}</td></tr>`)
        .join('');
    return `<table>${rows}</table>`;
}

// Funções utilitárias para nomes (rótulos)
function getConcessaoNome(properties) {
    if (!properties) return '';
    return (
        properties.NOME_FINAL ||
        properties.Nome ||
        properties.NAME ||
        properties.BLOCO ||
        properties.Lease_ID ||
        properties.NOME_1 ||
        ''
    );
}

function getPocoNome(properties) {
    if (!properties) return '';
    return (
        properties.SHORT_NAME ||
        properties.WELL_NAME ||
        properties.NAME ||
        ''
    );
}

// Estilos das camadas
const concessaoStyle = {
    color: '#d97706',
    weight: 2,
    fillColor: '#fbbf24',
    fillOpacity: 0.25
};

const pocosStyle = {
    radius: 4,
    color: '#0f172a',
    weight: 1.5,
    fillColor: '#22d3ee',
    fillOpacity: 0.9
};

// Grupos de camadas
const concessaoLayer = L.layerGroup();
// cluster para poços
const pocosCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 12,
    maxClusterRadius: 50
});

// Carrega GeoJSON de Concessão (polígonos/linhas)
function showStatus(message, isError) {
    const id = 'status-banner';
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.style.position = 'absolute';
        el.style.top = '8px';
        el.style.left = '8px';
        el.style.zIndex = '1000';
        el.style.padding = '6px 10px';
        el.style.borderRadius = '4px';
        el.style.fontFamily = 'system-ui, Arial, sans-serif';
        el.style.fontSize = '12px';
        el.style.background = 'rgba(0,0,0,0.6)';
        el.style.color = '#fff';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.background = isError ? 'rgba(185, 28, 28, 0.85)' : 'rgba(0,0,0,0.6)';
}

showStatus('Carregando camadas...', false);

const concessaoPromise = fetch('./Concessao_Angola_2025.geojson?cb=' + Date.now())
    .then(r => {
        if (!r.ok) throw new Error('Falha ao carregar Concessao_Angola_2025.geojson');
        return r.json();
    })
    .then(geojson => {
        const layer = L.geoJSON(geojson, {
            style: concessaoStyle,
            pane: 'paneConcessao',
            onEachFeature: (feature, layerEl) => {
                layerEl.bindPopup(buildPopupContent(feature.properties));
                const nome = getConcessaoNome(feature.properties);
                if (nome) {
                    layerEl.bindTooltip(String(nome), {
                        permanent: true,
                        direction: 'center',
                        className: 'label-concessao'
                    });
                }
                // destaque on hover
                layerEl.on('mouseover', () => layerEl.setStyle({ weight: 3, fillOpacity: 0.35 }));
                layerEl.on('mouseout', () => layerEl.setStyle(concessaoStyle));
            }
        }).bringToFront();
        layer.addTo(concessaoLayer);
        try {
            const b = layer.getBounds();
            if (b && b.isValid()) map.fitBounds(b.pad(0.1));
        } catch (_) {}
        console.log('Concessao carregada:', layer.getLayers().length, 'geometrias');
        return layer;
    })
    .catch(err => {
        console.error(err);
        showStatus('Erro ao carregar Concessao_Angola_2025.geojson', true);
    });

// Carrega GeoJSON de Poços (pontos)
const pocosPromise = fetch('./pocos_angola.geojson?cb=' + Date.now())
    .then(r => {
        if (!r.ok) throw new Error('Falha ao carregar pocos_angola.geojson');
        return r.json();
    })
    .then(geojson => {
        const layer = L.geoJSON(geojson, {
            pane: 'panePocos',
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, pocosStyle),
            onEachFeature: (feature, layerEl) => {
                layerEl.bindPopup(buildPopupContent(feature.properties));
                const nome = getPocoNome(feature.properties);
                if (nome) {
                    layerEl.bindTooltip(String(nome), {
                        permanent: true,
                        direction: 'top',
                        offset: [0, -6],
                        className: 'label-pocos'
                    });
                }
            }
        }).bringToFront();
        pocosCluster.addLayer(layer);
        pocosCluster.bringToFront();
        try {
            const b = layer.getBounds();
            if (b && b.isValid()) map.fitBounds(b.pad(0.1));
        } catch (_) {}
        console.log('Poços carregados:', layer.getLayers().length, 'pontos');
        return layer;
    })
    .catch(err => {
        console.error(err);
        showStatus('Erro ao carregar pocos_angola.geojson', true);
    });

// Adiciona overlays e controle de camadas
concessaoLayer.addTo(map);
pocosCluster.addTo(map);

const baseMaps = { 'OpenStreetMap': osm, 'Claro (CARTO)': cartoLight, 'Satélite (Esri)': esriSat, 'Topográfico (Esri)': esriTopo };
const overlayMaps = {
    'Concessão (2025)': concessaoLayer,
    'Poços (cluster)': pocosCluster
};
L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);
// expõe camada para controle de opacidade
window.concessaoLayer = concessaoLayer;

// Ajusta a visão para cobrir os dados quando ambos carregarem
Promise.allSettled([concessaoPromise, pocosPromise]).then(results => {
    const layers = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);
    if (layers.length > 0) {
        try {
            const group = L.featureGroup(layers);
            const bounds = group.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds.pad(0.1));
            }
        } catch (_) {
            // silencioso
        }
    }
    showStatus('Camadas carregadas.', false);
    // Esconde banner após 3 segundos
    setTimeout(() => {
        const banner = document.getElementById('status-banner');
        if (banner) banner.style.display = 'none';
    }, 3000);
}).catch(() => {
    showStatus('Erro ao carregar camadas.', true);
});

// Rótulos menos poluídos em zoom baixo
function updateLabelsVisibility() {
    const container = document.getElementById('map');
    if (!container) return;
    const z = map.getZoom();
    if (z < 7) {
        container.classList.add('labels-hidden');
    } else {
        container.classList.remove('labels-hidden');
    }
}
map.on('zoomend', updateLabelsVisibility);
updateLabelsVisibility();

// --- Controles adicionais ---
// Busca (geocoder) - Nominatim
try {
    if (L.Control && L.Control.Geocoder) {
        L.Control.geocoder({
            defaultMarkGeocode: true,
            collapsed: true,
            placeholder: 'Buscar endereço ou lugar...'
        }).addTo(map);
    }
} catch (_) {}

// Medição de distância/área
try {
    if (L.control && L.control.measure) {
        L.control.measure({
            primaryLengthUnit: 'kilometers',
            secondaryLengthUnit: 'meters',
            primaryAreaUnit: 'hectares',
            secondaryAreaUnit: 'sqmeters',
            position: 'topleft'
        }).addTo(map);
    }
} catch (_) {}

// Geolocalização do usuário
try {
    if (L.control && L.control.locate) {
        L.control.locate({
            position: 'topleft',
            setView: 'once',
            flyTo: true,
            keepCurrentZoomLevel: false,
            showCompass: true,
            strings: { title: 'Minha localização' }
        }).addTo(map);
    }
} catch (_) {}

// Impressão do mapa (print)
try {
    if (L.control && L.control.browserPrint) {
        L.control.browserPrint({
            position: 'topleft',
            title: 'Imprimir/Exportar',
            printModes: [
                L.control.browserPrint.mode.landscape(),
                L.control.browserPrint.mode.portrait(),
                L.control.browserPrint.mode.auto('Auto'),
                L.control.browserPrint.mode.custom('Selecionar área')
            ]
        }).addTo(map);
    }
} catch (_) {}

// Observação: se abrir o arquivo diretamente (file://), os GeoJSON podem não carregar.
// Use um servidor local simples (ex.: "python -m http.server 8000") e acesse http://localhost:8000/
