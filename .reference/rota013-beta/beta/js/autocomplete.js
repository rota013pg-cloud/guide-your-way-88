// ═══════════════════════════════════════════════════════
//  MÓDULO AUTOCOMPLETE — Google Places API
//  Endereço em tempo real conforme digitação
// ═══════════════════════════════════════════════════════

let _acService  = null;  // AutocompleteService (inicializado após Maps carregar)
let _geocoder   = null;  // Geocoder
let _acTimer    = null;  // Debounce timer
let _acActiveId = null;  // ID da lista ativa (para teclado)

// Inicializar quando o Google Maps estiver pronto
// Chamado pelo window.onload (após script do Maps com defer)
function initAutocomplete() {
  if (typeof google === 'undefined' || !google.maps?.places) {
    setTimeout(initAutocomplete, 500);
    return;
  }
  _geocoder  = new google.maps.Geocoder();
  _acService = new google.maps.places.AutocompleteService(); // sempre inicializa
  console.log('✅ Google Places Autocomplete pronto');
}

// Init via callback=initAutocomplete na URL do Maps (loading=async)

// ─── Buscar sugestões conforme digitação ─────────────
function autocompleteBuscar(input, listId) {
  clearTimeout(_acTimer);
  const query = input.value.trim();
  const list  = document.getElementById(listId);
  if (!list) return;

  if (query.length < 3) { fecharLista(list); return; }

  list.innerHTML = '<div class="autocomplete-loading">🔍 Buscando endereço...</div>';
  list.classList.add('active');
  _acActiveId = listId;

  _acTimer = setTimeout(() => {
    if (!_acService) {
      list.innerHTML = '<div class="autocomplete-loading">🔍 Buscando endereço...</div>';
      // Tentar inicializar e buscar novamente
      initAutocomplete();
      setTimeout(() => autocompleteBuscar(input, listId), 800);
      return;
    }

    _acService.getPlacePredictions(
      {
        input: query + (query.toLowerCase().includes('praia grande') ? '' : ', Praia Grande'),
        language: 'pt-BR',
        componentRestrictions: { country: 'br' },
        location: new google.maps.LatLng(-24.0122, -46.4097),
        radius: 15000,
        strictBounds: false
      },
      (predictions, status) => {
        if (status !== 'OK' || !predictions?.length) {
          list.innerHTML = '<div class="autocomplete-loading">Nenhum resultado encontrado</div>';
          return;
        }
        renderSugestoes(list, predictions, input);
      }
    );
  }, 380);
}

// ─── Renderizar lista de sugestões ────────────────────
function renderSugestoes(list, predictions, input) {
  list.innerHTML = predictions.slice(0, 6).map((p, i) => {
    const main = p.structured_formatting?.main_text   || p.description;
    const sec  = p.structured_formatting?.secondary_text || '';
    const pid  = p.place_id;
    return `<div class="autocomplete-item"
                 onclick="selecionarEndereco('${pid}','${input.id}')"
                 data-idx="${i}">
      <span class="autocomplete-item-icon">📍</span>
      <div>
        <div class="autocomplete-item-main">${main}</div>
        ${sec ? `<div class="autocomplete-item-sec">${sec}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─── Selecionar endereço da lista ────────────────────
function selecionarEndereco(placeId, inputId) {
  const input = document.getElementById(inputId);
  const wrap  = input?.closest('.autocomplete-wrap');
  const list  = wrap?.querySelector('.autocomplete-list');
  if (!input || !_geocoder) return;

  input.value = '⏳ Carregando endereço...';

  _geocoder.geocode({ placeId, language: 'pt-BR' }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const place   = results[0];
      input.value   = place.formatted_address;
      input.dataset.lat = place.geometry.location.lat();
      input.dataset.lng = place.geometry.location.lng();

      if (list) fecharLista(list);

      // Se os dois campos têm coordenadas, calcular distância/valor
      const outroId = inputId === 'corridaOrigem' ? 'corridaDestino' : 'corridaOrigem';
      const outro   = document.getElementById(outroId);
      if (outro?.dataset.lat && outro?.dataset.lng) {
        calcularValorPorCoordenadas();
      }
    } else {
      input.value = '';
      showToast('Erro ao buscar endereço. Tente novamente.');
    }
  });
}

// ─── Calcular distância e valor via OSRM ─────────────
async function calcularValorPorCoordenadas() {
  const orig  = document.getElementById('corridaOrigem');
  const dest  = document.getElementById('corridaDestino');
  const tabId = document.getElementById('corridaTarifa')?.value;
  const tab   = state_tarifas?.tabelasFixas?.find(t => t.id === tabId)
             || state_tarifas?.tabelaHibrida;

  if (!orig?.dataset.lat || !dest?.dataset.lat || !tab) return;

  try {
    const url  = `https://router.project-osrm.org/route/v1/driving/`
               + `${orig.dataset.lng},${orig.dataset.lat};`
               + `${dest.dataset.lng},${dest.dataset.lat}?overview=false`;
    const res  = await fetch(url);
    const data = await res.json();
    const km   = (data.routes?.[0]?.distance || 0) / 1000;
    const secs = data.routes?.[0]?.duration  || 0;

    if (km > 0) {
      const valor = Math.max(km * tab.valorKm, tab.tarifaMinima);
      const el = (id) => document.getElementById(id);
      if (el('corridaMetodo'))   el('corridaMetodo').value   = `GPS — ${tab.titulo}`;
      if (el('corridaDistancia'))el('corridaDistancia').value = `${km.toFixed(1)} km`;
      if (el('corridaDuracao'))  el('corridaDuracao').value   = formatarTempo(secs);
      // Preencher valor sugerido E valor final (se vazio)
      if (typeof preencherValorFinal === 'function') preencherValorFinal(valor);
      else if (el('corridaValor')) el('corridaValor').value = valor.toFixed(2);
      if (el('corridaValorFinal') && !el('corridaValorFinal').value) { const arr = typeof arredondarValor==='function' ? arredondarValor(valor) : Math.round(valor); el('corridaValorFinal').value = String(arr); }
      showToast(`📍 ${km.toFixed(1)} km · R$ ${valor.toFixed(2)}`);
    }
  } catch(e) {
    console.warn('OSRM erro:', e);
  }
}

function formatarTempo(s) {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m % 60}min`;
}

// ─── Fechar lista ─────────────────────────────────────
function fecharLista(list) {
  if (typeof list === 'string') list = document.getElementById(list);
  if (list) list.classList.remove('active');
}

// Fechar ao clicar fora
document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete-wrap')) {
    document.querySelectorAll('.autocomplete-list').forEach(fecharLista);
    _acActiveId = null;
  }
});
