// SCRUM-193 (HU45) — se carga automáticamente antes de cada archivo de test
// (ver vite.config.js -> test.setupFiles). Agrega los matchers de
// @testing-library/jest-dom (toBeInTheDocument, toHaveTextContent, etc.).
import '@testing-library/jest-dom';

// jsdom no trae IntersectionObserver (los navegadores sí) y framer-motion lo
// necesita para whileInView — el scroll-reveal de LandingInfo.
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
}
