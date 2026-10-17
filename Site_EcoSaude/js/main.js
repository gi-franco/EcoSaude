
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.querySelector("#menu-toggle");
  const menu = document.querySelector("#main-nav");
  const form = document.querySelector("#cep-form");
  const cepInput = document.querySelector("#cep");
  const error = document.querySelector("#cep-error");
  const status = document.querySelector("#search-status");
  const searchButton = document.querySelector("#search-button");
  const municipalityFilter = document.querySelector("#municipio-filter");

  function formatCep(value) {
    const digits = value.replace(/\D/g, "").slice(0, 8);

    return digits.length > 5
      ? `${digits.slice(0, 5)}-${digits.slice(5)}`
      : digits;
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  if (menuButton && menu) {
    menuButton.addEventListener("click", () => {
      const isOpen =
        menuButton.getAttribute("aria-expanded") === "true";

      menuButton.setAttribute("aria-expanded", String(!isOpen));

      const icon = menuButton.querySelector('[aria-hidden="true"]');
      const label = menuButton.querySelector(".sr-only");

      if (icon) icon.textContent = isOpen ? "☰" : "✕";
      if (label) label.textContent = isOpen ? "Abrir menu" : "Fechar menu";

      menu.classList.toggle("is-open", !isOpen);
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menu.classList.remove("is-open");
        menuButton.setAttribute("aria-expanded", "false");

        const icon = menuButton.querySelector('[aria-hidden="true"]');
        const label = menuButton.querySelector(".sr-only");

        if (icon) icon.textContent = "☰";
        if (label) label.textContent = "Abrir menu";
      });
    });
  }

  if (cepInput && error) {
    cepInput.addEventListener("input", () => {
      cepInput.value = formatCep(cepInput.value);
      cepInput.setCustomValidity("");
      cepInput.setAttribute("aria-invalid", "false");
      error.textContent = "";
    });
  }

  if (municipalityFilter) {
    municipalityFilter.addEventListener("change", () => {
      if (
        window.EcoSaude &&
        typeof window.EcoSaude.renderResults === "function"
      ) {
        window.EcoSaude.renderResults();
      }
    });
  }

  if (form && cepInput && searchButton) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (error) error.textContent = "";
      setStatus("");

      const cep = cepInput.value.replace(/\D/g, "");

      if (!/^\d{8}$/.test(cep)) {
        if (error) {
          error.textContent = "Digite um CEP válido com oito números.";
        }

        cepInput.setAttribute("aria-invalid", "true");
        cepInput.focus();
        return;
      }

      cepInput.setAttribute("aria-invalid", "false");
      searchButton.disabled = true;
      searchButton.textContent = "Pesquisando...";
      setStatus("Consultando o CEP informado...");

      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${cep}/json/`
        );

        if (!response.ok) {
          throw new Error(
            "Não foi possível consultar o serviço de CEP. Tente novamente."
          );
        }

        const address = await response.json();

        if (address.erro) {
          if (error) {
            error.textContent =
              "CEP não encontrado. Confira os números digitados.";
          }

          setStatus("");
          return;
        }

        setStatus(
          `CEP encontrado: ${[
            address.logradouro,
            address.bairro,
            address.localidade,
            address.uf
          ]
            .filter(Boolean)
            .join(", ")}. Localizando no mapa...`
        );

        if (
          !window.EcoSaude ||
          typeof window.EcoSaude.searchByCep !== "function"
        ) {
          setStatus(
            "O serviço de localização ainda não está disponível. Recarregue a página e tente novamente."
          );
          return;
        }

        await window.EcoSaude.searchByCep(address, cep);
      } catch (err) {
        if (error && !error.textContent) {
          error.textContent =
            err.message ||
            "Não foi possível concluir a consulta. Verifique sua conexão e tente novamente.";
        }

        setStatus(
          "Não foi possível concluir a localização. Você ainda pode consultar os ecopontos cadastrados."
        );
      } finally {
        searchButton.disabled = false;
        searchButton.textContent = "Pesquisar ecopontos";
      }
    });
  }

  if ("speechSynthesis" in window) {
    document
      .querySelectorAll("main section.content-section")
      .forEach((section) => {
        const heading = section.querySelector(".section-heading");

        if (!heading) return;

        const readButton = document.createElement("button");
        readButton.type = "button";
        readButton.className = "button button-secondary";
        readButton.textContent = "Ouvir esta seção";
        readButton.style.margin = "12px 0";

        readButton.addEventListener("click", () => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            readButton.textContent = "Ouvir esta seção";
            return;
          }

          const utterance = new SpeechSynthesisUtterance(
            section.innerText
          );

          utterance.lang = "pt-BR";

          utterance.onend = () => {
            readButton.textContent = "Ouvir esta seção";
          };

          utterance.onerror = () => {
            readButton.textContent = "Ouvir esta seção";
          };

          readButton.textContent = "Parar narração";
          window.speechSynthesis.speak(utterance);
        });

        heading.appendChild(readButton);
      });
  }
});
