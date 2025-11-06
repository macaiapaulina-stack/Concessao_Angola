// Inicializa o mapa centrado em Angola com otimizações de navegação
const map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true,           // renderer mais leve
    wheelDebounceTime: 60,        // suaviza o scroll
    wheelPxPerZoomLevel: 80,      // menos sensível
    zoomSnap: 0.25,
    zoomDelta: 0.5
}).setView([-11.2027, 17.8739], 7);

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

// Flag para controlar carregamento
let isLoadingInitial = true;
let concessaoData = null;
let pocosData = null;

// Função para mostrar progresso de carregamento
function updateProgress(message, percent) {
    const banner = document.getElementById('status-banner');
    if (banner) {
        banner.textContent = message + (percent !== undefined ? ` (${percent}%)` : '');
    }
}

// Função para carregar e renderizar camadas de forma não-bloqueante
function loadAndRenderLayers() {
    if (!concessaoData || !pocosData) return;
    
    showStatus('Renderizando camadas...', false);
    
    // Renderiza concessões de forma assíncrona
    requestAnimationFrame(() => {
        updateProgress('Renderizando Concessões...', 50);
        const concessaoLayerGeo = L.geoJSON(concessaoData, {
            style: concessaoStyle,
            pane: 'paneConcessao',
            renderer: L.canvas(),
            smoothFactor: 1.2,
            onEachFeature: (f, l) => {
                l.feature = f;
                l.on('mouseover', () => l.setStyle({ weight: 3, fillOpacity: 0.35 }));
                l.on('mouseout', () => l.setStyle(concessaoStyle));
            }
        });
        
        window.concessaoLayer.addLayer(concessaoLayerGeo);
        updateProgress('Concessões renderizadas', 70);
        
        // Faz zoom automático na área das concessões
        try {
            const bounds = concessaoLayerGeo.getBounds();
            if (bounds && bounds.isValid()) {
                map.fitBounds(bounds, {
                    padding: [50, 50], // padding para não cortar bordas
                    maxZoom: 12 // zoom máximo para não aproximar demais
                });
            }
        } catch (e) {
            console.warn('Erro ao ajustar zoom nas concessões:', e);
        }
        
        // Adiciona popups/tooltips depois de forma assíncrona
        const addConcessaoLabels = () => {
            concessaoLayerGeo.eachLayer(l => {
                if (!l.feature) return;
                // popup sob demanda para reduzir custo
                l.off('click');
                l.on('click', () => l.bindPopup(buildPopupContent(l.feature.properties)).openPopup());
                // rótulo somente em hover e sem permanência (mais leve)
                const nome = getConcessaoNome(l.feature.properties);
                if (nome) {
                    l.off('mouseover');
                    l.on('mouseover', () => {
                        l.bindTooltip(String(nome), { direction: 'center', sticky: true, className: 'label-concessao' }).openTooltip();
                    });
                }
            });
        };
        if (window.requestIdleCallback) {
            requestIdleCallback(addConcessaoLabels, { timeout: 2000 });
        } else {
            setTimeout(addConcessaoLabels, 1000);
        }
    });
    
    // Renderiza poços de forma assíncrona
    requestAnimationFrame(() => {
        setTimeout(() => {
            updateProgress('Renderizando Poços...', 80);
            const pocosLayerGeo = L.geoJSON(pocosData, {
                pane: 'panePocos',
                pointToLayer: (feature, latlng) => {
                    const marker = L.circleMarker(latlng, pocosStyle);
                    marker.feature = feature;
                    return marker;
                }
            });
            
            window.pocosCluster.addLayer(pocosLayerGeo);
            window.pocosCluster.bringToFront();
            updateProgress('Poços renderizados', 95);
            
            // Adiciona popups/tooltips depois de forma assíncrona
            const addPocosLabels = () => {
                pocosLayerGeo.eachLayer(m => {
                    if (!m.feature) return;
                    // popup sob demanda
                    m.off('click');
                    m.on('click', () => m.bindPopup(buildPopupContent(m.feature.properties)).openPopup());
                    // sem rótulos permanentes para reduzir custo visual
                });
            };
            if (window.requestIdleCallback) {
                requestIdleCallback(addPocosLabels, { timeout: 2000 });
            } else {
                setTimeout(addPocosLabels, 1000);
            }
            
            // Após desenhar concessões, centraliza na área das concessões com zoom máximo controlado
            try {
                const b = window.concessaoLayer.getBounds();
                if (b && b.isValid()) {
                    map.fitBounds(b, { padding: [30, 30], maxZoom: 9 });
                }
            } catch (_) {}

            showStatus('Camadas carregadas!', false);
            
            setTimeout(() => {
                const banner = document.getElementById('status-banner');
                if (banner) {
                    banner.style.transition = 'opacity 0.5s';
                    banner.style.opacity = '0';
                    setTimeout(() => banner.style.display = 'none', 500);
                }
            }, 2000);
        }, 100);
    });
}

// Carrega dados JSON primeiro (sem renderizar)
showStatus('Carregando dados...', false);

const concessaoPromise = fetch('./Concessao_Angola_2025.geojson?cb=' + Date.now())
    .then(r => {
        if (!r.ok) throw new Error('Falha ao carregar Concessao_Angola_2025.geojson');
        updateProgress('Carregando Concessões...', 30);
        return r.json();
    })
    .then(geojson => {
        concessaoData = geojson;
        updateProgress('Dados de Concessões carregados', 50);
        console.log('Concessao dados carregados:', geojson.features?.length || 0, 'features');
        return geojson;
    })
    .catch(err => {
        console.error(err);
        showStatus('Erro ao carregar Concessao_Angola_2025.geojson', true);
    });

// Carrega GeoJSON de Poços (pontos)
const pocosPromise = fetch('./pocos_angola.geojson?cb=' + Date.now())
    .then(r => {
        if (!r.ok) throw new Error('Falha ao carregar pocos_angola.geojson');
        updateProgress('Carregando Poços...', 70);
        return r.json();
    })
    .then(geojson => {
        pocosData = geojson;
        updateProgress('Dados de Poços carregados', 90);
        console.log('Poços dados carregados:', geojson.features?.length || 0, 'features');
        return geojson;
    })
    .catch(err => {
        console.error(err);
        showStatus('Erro ao carregar pocos_angola.geojson', true);
    });

// Adiciona overlays e controle de camadas ANTES do carregamento para permitir navegação
concessaoLayer.addTo(map);
pocosCluster.addTo(map);

const baseMaps = { 'OpenStreetMap': osm, 'Claro (CARTO)': cartoLight, 'Satélite (Esri)': esriSat, 'Topográfico (Esri)': esriTopo };
const overlayMaps = {
    'Concessão (2025)': concessaoLayer,
    'Poços (cluster)': pocosCluster
};
L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);
// expõe camadas para controle de opacidade e renderização
window.concessaoLayer = concessaoLayer;
window.pocosCluster = pocosCluster;

// Quando ambos os dados estiverem carregados, inicia renderização
Promise.allSettled([concessaoPromise, pocosPromise]).then(results => {
    const allLoaded = results.every(r => r.status === 'fulfilled');
    if (allLoaded && concessaoData && pocosData) {
        // Aguarda um pouco para garantir que o mapa está pronto
        setTimeout(() => {
            loadAndRenderLayers();
        }, 500);
    } else {
        showStatus('Erro ao carregar dados.', true);
    }
}).catch(() => {
    showStatus('Erro ao carregar camadas.', true);
});

// Rótulos menos poluídos em zoom baixo
function updateLabelsVisibility() {
    const container = document.getElementById('map');
    if (!container) return;
    const z = map.getZoom();
    if (z >= 7) {
        container.classList.remove('labels-hidden');
    } else {
        container.classList.add('labels-hidden');
    }
}
map.on('zoomend', updateLabelsVisibility);
map.on('zoom', updateLabelsVisibility);
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
