const PRINTFORGE_BRAND = Object.freeze({
  name: "PrintForge",
  tagline: "Connect. Print. Scan. Simplified.",
  logoVersion: "temporary-product-mark-v1",
  gradient: {
    from: "#F15FA5",
    via: "#8B6CFF",
    to: "#4FA3FF",
  },
});

class PrintForgeLogo extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) {
      return;
    }

    const variant = this.getAttribute("variant") || "horizontal";
    const size = this.getAttribute("size") || "small";
    const showWordmark = variant !== "mark";
    const showTagline = variant === "stacked";

    this.setAttribute("role", "img");
    if (!this.hasAttribute("aria-label")) {
      this.setAttribute("aria-label", PRINTFORGE_BRAND.name);
    }

    const root = this.attachShadow({ mode: "open" });

    root.innerHTML = `
      <style>
        :host {
          --logo-mark-size: 44px;
          display: inline-flex;
          color: var(--text-primary, #E6E8EE);
          font-family: var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif);
          line-height: 1;
        }

        :host([size="tiny"]) {
          --logo-mark-size: 36px;
        }

        :host([size="large"]) {
          --logo-mark-size: 68px;
        }

        .logo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
        }

        :host([variant="stacked"]) .logo {
          align-items: center;
          flex-direction: column;
          gap: 14px;
          text-align: center;
        }

        .mark {
          position: relative;
          display: grid;
          width: var(--logo-mark-size);
          height: var(--logo-mark-size);
          place-items: center;
          overflow: hidden;
          border: 1px solid transparent;
          border-radius: 16px;
          background:
            linear-gradient(150deg, rgba(30, 34, 43, 0.94), rgba(23, 26, 33, 0.98)) padding-box,
            linear-gradient(135deg, rgba(241, 95, 165, 0.7), rgba(139, 108, 255, 0.82), rgba(79, 163, 255, 0.9)) border-box;
          box-shadow:
            0 14px 34px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .mark::after {
          position: absolute;
          inset: 5px;
          border: 1px solid rgba(230, 232, 238, 0.06);
          border-radius: 12px;
          content: "";
        }

        svg {
          position: relative;
          z-index: 1;
          width: 72%;
          height: 72%;
          overflow: visible;
        }

        .paper {
          fill: rgba(230, 232, 238, 0.035);
          stroke: rgba(230, 232, 238, 0.84);
          stroke-width: 1.7;
        }

        .fold {
          fill: rgba(230, 232, 238, 0.08);
          stroke: rgba(230, 232, 238, 0.6);
          stroke-width: 1.4;
        }

        .flow {
          fill: none;
          stroke: url(#printforge-gradient);
          stroke-linecap: round;
          stroke-width: 2.4;
        }

        .node {
          fill: #101319;
          stroke-width: 1.8;
        }

        .node-start {
          stroke: rgba(241, 95, 165, 0.72);
        }

        .node-end {
          stroke: rgba(79, 163, 255, 0.9);
        }

        .wordmark {
          display: grid;
          gap: 5px;
        }

        strong {
          color: var(--text-primary, #E6E8EE);
          font-size: 1.08rem;
          font-weight: 650;
          letter-spacing: 0;
        }

        :host([size="large"]) strong {
          font-size: 1.55rem;
        }

        span {
          color: var(--text-secondary, #A0A6B2);
          font-size: 0.78rem;
          letter-spacing: 0;
        }
      </style>

      <span class="logo" aria-label="${PRINTFORGE_BRAND.name}">
        <span class="mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" focusable="false">
            <defs>
              <linearGradient id="printforge-gradient" x1="10" y1="32" x2="38" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="${PRINTFORGE_BRAND.gradient.from}" stop-opacity="0.7" />
                <stop offset="0.52" stop-color="${PRINTFORGE_BRAND.gradient.via}" stop-opacity="0.86" />
                <stop offset="1" stop-color="${PRINTFORGE_BRAND.gradient.to}" stop-opacity="0.9" />
              </linearGradient>
            </defs>
            <path class="paper" d="M15 12.5h13.2L33 17.3v17.2H15V12.5Z" />
            <path class="fold" d="M28.2 12.5v5h4.8" />
            <path class="flow" d="M11.5 29.2c4.7-3.6 9.4-3.6 14.1 0 3.8 2.9 7.7 2.9 11.6 0" />
            <circle class="node node-start" cx="11.5" cy="29.2" r="2.2" />
            <circle class="node node-end" cx="37.2" cy="29.2" r="2.2" />
          </svg>
        </span>
        ${
          showWordmark
            ? `<span class="wordmark"><strong>${PRINTFORGE_BRAND.name}</strong>${
                showTagline ? `<span>${PRINTFORGE_BRAND.tagline}</span>` : ""
              }</span>`
            : ""
        }
      </span>
    `;
  }
}

customElements.define("printforge-logo", PrintForgeLogo);
window.PrintForgeBrand = PRINTFORGE_BRAND;
