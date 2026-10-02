// Props para que un elemento que no es <button> (una tarjeta, una fila, un
// campo que abre un menú) se pueda usar con el teclado —Enter o Espacio— y el
// lector de pantalla lo anuncie como botón. Uso: <div {...comoBoton(abrir)}>.
// Solo reacciona cuando el foco está en el propio elemento, para no robarle
// las teclas a los botones o campos que tenga adentro.
export const comoBoton = (accion) => ({
  role: 'button',
  tabIndex: 0,
  onKeyDown: (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      accion(e);
    }
  },
});
