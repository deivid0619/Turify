import { T, Boton, TableroRuta, IconMapa, IconPrecio, IconVisto, IconEscudo, IconDocumento,
         IconTarjeta, IconAuto, IconPin, IconRecibo, LogoWordmark, Resalte } from './diseno';
import { motion } from 'framer-motion';

const BRAND_GREEN = 'var(--t-ruta)';

// Rutas reales para mostrar el alcance — más de las 6 que rotan en el tablero
// del hero, para que la sección de cobertura se sienta más completa sin
// repetir el mismo componente vacío.
const RUTAS_COBERTURA = [
  ['Palmitas', 'Medellín'],
  ['Santa Elena', 'Rionegro'],
  ['El Retiro', 'La Ceja'],
  ['Urrao', 'Concordia'],
  ['San Vicente', 'Guarne'],
  ['Támesis', 'Jericó'],
  ['San Jerónimo', 'Medellín'],
  ['Sonsón', 'Abejorral'],
];

const PASOS = [
  { Ico: IconMapa, titulo: 'Publicá tu viaje', texto: 'Origen, destino, fecha y cuántos van — hasta la última vereda, no solo cabeceras municipales.' },
  { Ico: IconPrecio, titulo: 'Mirá el precio sugerido', texto: 'Un motor de precio calcula una referencia según ruta y distancia. Lo usás tal cual o negociás directo con cada conductor.' },
  { Ico: IconVisto, titulo: 'Un conductor lo acepta', texto: 'Conductores afiliados a empresas de transporte especial habilitadas, con vehículo y documentos vigentes.' },
  { Ico: IconEscudo, titulo: 'Viajá con el papeleo en regla', texto: 'El conductor sube el FUEC de su empresa y los ocupantes quedan registrados antes de salir.' },
];

const DOCUMENTOS = [
  { Ico: IconTarjeta, label: 'SOAT vigente' },
  { Ico: IconDocumento, label: 'Licencia de conducción' },
  { Ico: IconRecibo, label: 'Tarjeta de operación' },
  { Ico: IconEscudo, label: 'Seguros contractual y extracontractual' },
];

const LandingInfo = ({ onQuieroConducir }) => {
  return (
    <div style={{ background: 'var(--t-papel)', fontFamily: T.ui }}>
      <style>{`
        /* Todas las secciones: franja de ancho completo + contenido en la misma
           columna centrada, así todo arranca en el mismo borde. */
        .li-banda { padding:clamp(56px,8vw,96px) clamp(20px,5vw,64px); }
        .li-contenido { max-width:1180px; margin:0 auto; }
        .li-rotulo { font-family:${T.dato}; font-size:11px; letter-spacing:.16em; text-transform:uppercase;
                     color:${BRAND_GREEN}; margin:0 0 12px; }
        .li-h2 { font-family:${T.frase}; font-weight:400; font-size:clamp(26px,3.4vw,38px); line-height:1.2;
                 letter-spacing:-.01em; color:var(--t-tinta); margin:0 0 14px; max-width:28ch; text-wrap:balance; }
        .li-intro { font-size:15px; line-height:1.65; color:var(--t-piedra); max-width:56ch; margin:0 0 48px; }
        .li-grid-pasos { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr)); gap:28px; }
        .li-paso { display:flex; flex-direction:column; gap:12px; }
        /* Número del paso en el naranja de la marca (--t-resalte: legible sobre papel). */
        .li-paso-num { font-family:${T.display}; font-weight:700; font-size:22px; line-height:1;
                       color:${T.resalte}; letter-spacing:.02em; font-variant-numeric:tabular-nums; }
        .li-paso-ico { width:44px; height:44px; border-radius:12px; background:var(--t-musgo);
                       display:flex; align-items:center; justify-content:center; color:${BRAND_GREEN}; }
        .li-paso-titulo { font-family:${T.display}; font-weight:700; font-size:16.5px; color:var(--t-tinta); margin:0; }
        .li-paso-texto { font-size:13.5px; line-height:1.6; color:var(--t-piedra); margin:0; }
        .li-rutas-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr)); gap:12px; }
        .li-ruta-tarjeta { background:var(--t-niebla); border:1px solid var(--t-linea); border-radius:12px; padding:16px; }
        .li-doc-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr)); gap:16px; }
        .li-doc { display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; padding:18px 12px;
                  background:var(--t-niebla); border:1px solid var(--t-linea); border-radius:12px; }
        .li-footer { border-top:1px solid var(--t-linea); padding:32px clamp(20px,5vw,64px); }
        .li-footer .li-contenido { display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between; }
        @media (max-width:640px) { .li-footer .li-contenido { flex-direction:column; align-items:flex-start; } }
      `}</style>

      {/* CÓMO FUNCIONA */}
      <section className="li-banda">
        <div className="li-contenido">
        <p className="li-rotulo">Cómo funciona</p>
        <h2 className="li-h2">De publicar el viaje a subirte, en <Resalte>cuatro pasos.</Resalte></h2>
        <p className="li-intro">Sin intermediarios ocultos: vos ves el precio, el conductor ve tu ruta, y los dos
          saben qué hace falta antes de salir.</p>
        <div className="li-grid-pasos">
          {PASOS.map((p, i) => (
            <motion.div key={i} className="li-paso"
              initial={{ clipPath: 'inset(0 0 100% 0)' }}
              whileInView={{ clipPath: 'inset(0 0 0% 0)' }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.77, 0, 0.175, 1] }}>
              <div className="li-paso-ico"><p.Ico size={20} /></div>
              <span className="li-paso-num">0{i + 1}</span>
              <h3 className="li-paso-titulo">{p.titulo}</h3>
              <p className="li-paso-texto">{p.texto}</p>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      {/* COBERTURA */}
      <section className="li-banda" style={{ background: 'var(--t-niebla)', borderTop: '1px solid var(--t-linea)', borderBottom: '1px solid var(--t-linea)' }}>
        <div className="li-contenido">
          <p className="li-rotulo">Cobertura</p>
          <h2 className="li-h2">Llegamos donde el transporte convencional <Resalte>no llega.</Resalte></h2>
          <p className="li-intro">Buses y taxis convencionales cubren las rutas grandes. Turify existe para todo lo
            demás — fincas, veredas y corregimientos que necesitan transporte especial para moverse.</p>
          <div className="li-rutas-grid">
            {RUTAS_COBERTURA.map(([origen, destino], i) => (
              <motion.div key={i} className="li-ruta-tarjeta"
                initial={{ clipPath: 'inset(0 0 100% 0)' }}
                whileInView={{ clipPath: 'inset(0 0 0% 0)' }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.6, delay: Math.min(i, 6) * 0.05, ease: [0.77, 0, 0.175, 1] }}>
                <TableroRuta origen={origen} destino={destino} size={12} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* VIAJES VERIFICADOS */}
      <section className="li-banda">
        <div className="li-contenido">
        <p className="li-rotulo">Seguridad</p>
        <h2 className="li-h2">Cada conductor, <Resalte>verificado</Resalte> antes de recibir un solo viaje.</h2>
        <p className="li-intro">Turify revisa que estos documentos existan y no estén vencidos antes de habilitar
          una cuenta de conductor — no garantiza lo que certifica la empresa afiliada, pero sí que el papeleo
          básico esté al día.</p>
        <div className="li-doc-grid">
          {DOCUMENTOS.map((d, i) => (
            <motion.div key={i} className="li-doc"
              initial={{ clipPath: 'inset(0 0 100% 0)' }}
              whileInView={{ clipPath: 'inset(0 0 0% 0)' }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.77, 0, 0.175, 1] }}>
              <d.Ico size={22} color={BRAND_GREEN} />
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--t-tinta)', lineHeight: 1.4 }}>{d.label}</span>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      {/* CTA CONDUCTORES */}
      <section className="li-banda" style={{ background: 'var(--t-monte)' }}>
        <div className="li-contenido" style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: '480px' }}>
            <p className="li-rotulo" style={{ color: 'var(--t-chiva)' }}>Para conductores</p>
            <h2 style={{ fontFamily: T.frase, fontWeight: 400, fontSize: 'clamp(24px,3vw,32px)', lineHeight: 1.2, letterSpacing: '-.01em', color: '#fff', margin: '0 0 10px', textWrap: 'balance' }}>
              ¿Tenés vehículo? <Resalte sobreOscuro>Conducí</Resalte> cuando quieras.
            </h2>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(234,242,236,.7)', margin: 0 }}>
              Vos decidís qué ofertas tomar. Recibís solicitudes de tu zona, incluso en veredas pequeñas.
            </p>
          </div>
          <Boton type="button" onClick={onQuieroConducir} style={{ padding: '14px 28px', flexShrink: 0 }}>
            <IconAuto size={16} style={{ verticalAlign: '-3px', marginRight: '8px' }} />Empezar a conducir
          </Boton>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="li-footer">
        <div className="li-contenido">
        <LogoWordmark alto={14} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', fontSize: '12.5px', color: 'var(--t-piedra)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><IconPin size={13} />Antioquia, Colombia</span>
          <a href="/politicas" target="_blank" rel="opener" style={{ color: 'inherit' }}>Términos, privacidad y demás políticas</a>
          <a href="mailto:soporte.turify@gmail.com" style={{ color: 'inherit' }}>soporte.turify@gmail.com</a>
          <span>© 2026 Turify</span>
        </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingInfo;
