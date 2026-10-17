
(() => {
  "use strict";

  const DATA_URL = "data/ecopoints.json";
  const GEOCODING_API =
    "https://nominatim.openstreetmap.org/search";

  const resultsContainer = document.getElementById("ecopoint-results");
  const municipalityFilter = document.getElementById("municipio-filter");
  const statusElement = document.getElementById("search-status");
  const cepErrorElement = document.getElementById("cep-error");

  let ecopoints = [];
  let reference = null;
  let loading = false;

  function normalizar(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function getLatitude(point) {
    const value = point.latitude ?? point.lat;

    if (value === null || value === undefined || value === "") {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) && number >= -90 && number <= 90
      ? number
      : null;
  }

  function getLongitude(point) {
    const value = point.longitude ?? point.lon ?? point.lng;

    if (value === null || value === undefined || value === "") {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) && number >= -180 && number <= 180
      ? number
      : null;
  }

  function temCoordenadas(point) {
    return (
      getLatitude(point) !== null &&
      getLongitude(point) !== null
    );
  }

  function distanciaKm(lat1, lon1, lat2, lon2) {
    const raioTerra = 6371;
    const radianos = (graus) => (graus * Math.PI) / 180;

    const diferencaLat = radianos(lat2 - lat1);
    const diferencaLon = radianos(lon2 - lon1);

    const a =
      Math.sin(diferencaLat / 2) ** 2 +
      Math.cos(radianos(lat1)) *
        Math.cos(radianos(lat2)) *
        Math.sin(diferencaLon / 2) ** 2;

    return 2 * raioTerra * Math.asin(Math.sqrt(a));
  }

  function distancia(point) {
    if (!reference || !temCoordenadas(point)) return null;

    return distanciaKm(
      reference.lat,
      reference.lon,
      getLatitude(point),
      getLongitude(point)
    );
  }

  function criarElemento(tag, texto, classe) {
    const elemento = document.createElement(tag);

    if (texto !== undefined && texto !== null) {
      elemento.textContent = texto;
    }

    if (classe) elemento.className = classe;

    return elemento;
  }

  function criarLink(url, texto, classe = "ecopoint-link") {
    const link = document.createElement("a");

    link.className = classe;
    link.textContent = texto;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    return link;
  }

  function criarCard(point, km = null) {
    const card = criarElemento("article", null, "ecopoint-card");

    const titulo = criarElemento("h3", point.nome || "Ecoponto");

    const municipio = criarElemento(
      "p",
      point.municipio || "Município não informado",
      "ecopoint-municipality"
    );

    const endereco = criarElemento(
      "p",
      `Endereço: ${point.endereco || "Consulte a fonte oficial."}`
    );

    const horario = criarElemento(
      "p",
      `Horário: ${
        point.horario || "Não informado; confirme com a prefeitura."
      }`
    );

    card.append(titulo, municipio, endereco, horario);

    if (Array.isArray(point.materiais) && point.materiais.length > 0) {
      card.append(
        criarElemento(
          "p",
          `Materiais aceitos: ${point.materiais.join(", ")}`
        )
      );
    } else {
      card.append(
        criarElemento(
          "p",
          "Materiais aceitos: confirme antes de levar resíduos."
        )
      );
    }

    if (km !== null) {
      card.append(
        criarElemento(
          "p",
          `Distância aproximada em linha reta: ${km.toFixed(1)} km`
        )
      );
    } else if (reference && !temCoordenadas(point)) {
      card.append(
        criarElemento(
          "p",
          "Distância indisponível: as coordenadas deste local ainda não foram verificadas.",
          "ecopoint-notice"
        )
      );
    }

    const links = criarElemento("div", null, "ecopoint-actions");

    if (point.fonte) {
      links.append(criarLink(point.fonte, "Fonte oficial"));
    }

    const enderecoCompleto = [
      point.nome,
      point.endereco,
      point.municipio,
      "SP",
      "Brasil"
    ]
      .filter(Boolean)
      .join(", ");

    const pesquisaMaps =
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        enderecoCompleto
      )}`;

    links.append(
      criarLink(pesquisaMaps, "Localizar no Google Maps")
    );

    if (temCoordenadas(point)) {
      const lat = getLatitude(point);
      const lon = getLongitude(point);

      const rotaUrl =
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

      links.append(criarLink(rotaUrl, "Traçar rota"));

      const mapButton = document.createElement("button");

      mapButton.type = "button";
      mapButton.className = "ecopoint-link";
      mapButton.textContent = "Ver no mapa";

      mapButton.addEventListener("click", () => {
        window.EcoSaudeMap?.focusPoint(point);
      });

      links.append(mapButton);
    }

    card.append(links);

    return card;
  }

  function obterMunicipioSelecionado() {
    return municipalityFilter?.value || "";
  }

  function filtrarPorMunicipio(lista) {
    const selecionado = normalizar(obterMunicipioSelecionado());

    if (!selecionado) return lista;

    return lista.filter(
      (point) => normalizar(point.municipio) === selecionado
    );
  }

  function ordenarPorDistancia(lista) {
    if (!reference) return lista;

    return [...lista].sort((a, b) => {
      const distanciaA = distancia(a);
      const distanciaB = distancia(b);

      if (distanciaA === null && distanciaB === null) return 0;
      if (distanciaA === null) return 1;
      if (distanciaB === null) return -1;

      return distanciaA - distanciaB;
    });
  }

  function renderResults() {
    if (!resultsContainer) return;

    resultsContainer.replaceChildren();

    if (loading) {
      resultsContainer.append(
        criarElemento("p", "Carregando ecopontos...")
      );
      return;
    }

    const municipio = obterMunicipioSelecionado();

    const lista = ordenarPorDistancia(
      filtrarPorMunicipio(ecopoints)
    );

    if (lista.length === 0) {
      resultsContainer.append(
        criarElemento(
          "p",
          municipio
            ? "Nenhum ecoponto cadastrado para este município."
            : "Nenhum ecoponto cadastrado no momento."
        )
      );
      return;
    }

    if (reference) {
      const comCoordenadas = lista.filter(temCoordenadas);
      const semCoordenadas = lista.filter(
        (point) => !temCoordenadas(point)
      );

      if (comCoordenadas.length > 0) {
        resultsContainer.append(
          criarElemento("h3", "Ecopontos mais próximos")
        );

        comCoordenadas.slice(0, 5).forEach((point) => {
          resultsContainer.append(
            criarCard(point, distancia(point))
          );
        });

        if (comCoordenadas.length > 5) {
          const outros = criarElemento(
            "details",
            null,
            "other-ecopoints"
          );

          outros.append(
            criarElemento(
              "summary",
              `Ver outros ${
                comCoordenadas.length - 5
              } ecopontos com localização confirmada`
            )
          );

          comCoordenadas.slice(5).forEach((point) => {
            outros.append(criarCard(point, distancia(point)));
          });

          resultsContainer.append(outros);
        }
      } else {
        resultsContainer.append(
          criarElemento(
            "p",
            "Ainda não há coordenadas verificadas para calcular quais ecopontos ficam mais próximos. Consulte os endereços e as fontes oficiais abaixo."
          )
        );
      }

      if (semCoordenadas.length > 0) {
        const outros = criarElemento(
          "details",
          null,
          "other-ecopoints"
        );

        outros.append(
          criarElemento(
            "summary",
            `Ver ${semCoordenadas.length} ecoponto(s) sem coordenadas verificadas`
          )
        );

        semCoordenadas.forEach((point) => {
          outros.append(criarCard(point));
        });

        resultsContainer.append(outros);
      }
    } else {
      resultsContainer.append(
        criarElemento(
          "p",
          `${lista.length} ecoponto(s) encontrado(s). Informe um CEP para calcular a proximidade quando houver coordenadas verificadas.`
        )
      );

      lista.forEach((point) => {
        resultsContainer.append(criarCard(point));
      });
    }
  }

  async function buscarCoordenadas(endereco, cep) {
    const chaveCache = `ecosaude-geocode-${cep}`;
    const cache = cep ? localStorage.getItem(chaveCache) : null;

    if (cache) {
      try {
        const coordenadas = JSON.parse(cache);

        if (
          Number.isFinite(coordenadas.lat) &&
          Number.isFinite(coordenadas.lon) &&
          coordenadas.lat >= -90 &&
          coordenadas.lat <= 90 &&
          coordenadas.lon >= -180 &&
          coordenadas.lon <= 180
        ) {
          return coordenadas;
        }

        localStorage.removeItem(chaveCache);
      } catch {
        localStorage.removeItem(chaveCache);
      }
    }

    const consultas = [];

    // Primeira tentativa: endereço completo e CEP.
    consultas.push(
      [
        endereco,
        cep ? `CEP ${cep}` : "",
        "Brasil"
      ]
        .filter(Boolean)
        .join(", ")
    );

    // Segunda tentativa: município e estado, caso o endereço completo
    // não seja encontrado. A localização será aproximada.
    const partes = endereco
      .split(",")
      .map((parte) => parte.trim())
      .filter(Boolean);

    if (partes.length >= 2) {
      const municipio = partes[partes.length - 2];
      const estado = partes[partes.length - 1];

      const consultaAlternativa = [
        municipio,
        estado,
        "Brasil"
      ].join(", ");

      if (
        !consultas.some(
          (consulta) =>
            normalizar(consulta) === normalizar(consultaAlternativa)
        )
      ) {
        consultas.push(consultaAlternativa);
      }
    }

    for (const textoConsulta of consultas) {
      const parametros = new URLSearchParams({
        format: "jsonv2",
        limit: "1",
        countrycodes: "br",
        q: textoConsulta
      });

      const resposta = await fetch(
        `${GEOCODING_API}?${parametros}`
      );

      if (resposta.status === 429) {
        throw new Error(
          "O serviço de mapas recebeu muitas consultas. Aguarde um pouco e tente novamente."
        );
      }

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível consultar o serviço de localização. Tente novamente."
        );
      }

      const dados = await resposta.json();

      if (!Array.isArray(dados) || dados.length === 0) {
        continue;
      }

      const lat = Number(dados[0].lat);
      const lon = Number(dados[0].lon);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        continue;
      }

      const coordenadas = { lat, lon };

      if (cep) {
        localStorage.setItem(
          chaveCache,
          JSON.stringify(coordenadas)
        );
      }

      return coordenadas;
    }

    throw new Error(
      "O CEP foi encontrado, mas o serviço de mapas não conseguiu localizar o endereço. Confira se o ViaCEP retornou o logradouro e tente novamente mais tarde."
    );
  }

  async function searchByCep(address, cep = "") {
    if (!address) {
      throw new Error("O endereço não foi informado.");
    }

    const enderecoTexto =
      typeof address === "string"
        ? address
        : [
            address.logradouro,
            address.bairro,
            address.localidade,
            address.uf
          ]
            .filter(Boolean)
            .join(", ");

    const cepLimpo = String(
      cep || (typeof address === "object" ? address.cep : "")
    ).replace(/\D/g, "");

    if (!enderecoTexto.trim()) {
      throw new Error(
        "Não foi possível montar o endereço a partir do CEP."
      );
    }

    if (statusElement) {
      statusElement.textContent =
        "Localizando o endereço no mapa...";
    }

    if (cepErrorElement) {
      cepErrorElement.textContent = "";
    }

    try {
      const coordenadas = await buscarCoordenadas(
        enderecoTexto,
        cepLimpo
      );

      reference = coordenadas;

      window.EcoSaudeMap?.showReference(coordenadas);

      renderResults();

      if (statusElement) {
        statusElement.textContent =
          "Endereço localizado. A lista mostra os ecopontos com coordenadas verificadas mais próximos.";
      }
    } catch (erro) {
      if (cepErrorElement) {
        cepErrorElement.textContent =
          erro.message || "Ocorreu um erro ao localizar o CEP.";
      }

      if (statusElement) {
        statusElement.textContent =
          "Não foi possível posicionar o endereço no mapa. Você ainda pode consultar os ecopontos cadastrados.";
      }

      // Não relança o erro. Isso impede que o main.js
      // apresente a mesma mensagem uma segunda vez.
    }
  }

  async function carregarEcopontos() {
    if (!resultsContainer) return;

    loading = true;
    renderResults();

    try {
      const resposta = await fetch(DATA_URL);

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível carregar o arquivo de ecopontos."
        );
      }

      const dados = await resposta.json();

      ecopoints = Array.isArray(dados) ? dados : [];

      window.EcoSaudeMap?.refresh();

      ecopoints.forEach((point) => {
        if (temCoordenadas(point)) {
          window.EcoSaudeMap?.addEcopoint(point);
        }
      });
    } catch (erro) {
      console.error("Erro ao carregar ecopontos:", erro);

      resultsContainer.replaceChildren(
        criarElemento(
          "p",
          "Não foi possível carregar os ecopontos. Verifique se o site está aberto pelo Live Server e se data/ecopoints.json existe."
        )
      );
    } finally {
      loading = false;
      renderResults();
    }
  }

  municipalityFilter?.addEventListener(
    "change",
    renderResults
  );

  window.EcoSaude = {
    searchByCep,
    renderResults,
    distanciaKm,
    temCoordenadas,
    getLatitude,
    getLongitude
  };

  carregarEcopontos();
})();
