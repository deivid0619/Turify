import { useNavigate } from 'react-router-dom';
import { T, EstilosBase, LogoWordmark, IconAlerta, IconEquis } from './diseno';

// Contenido legal — Términos, Habeas Data, Pagos, Cancelaciones y PQRS. Texto tomado
// tal cual del borrador que se viene trabajando (doc "Políticas Legales de
// Turify"); si se corrige allá, hay que traer el cambio acá también, no hay
// sincronización automática entre el doc de trabajo y esta página.
const BRAND_GREEN = 'var(--t-ruta)';

const Seccion = ({ id, numero, titulo, children }) => (
  <section id={id} style={{ marginBottom: '48px', scrollMarginTop: '90px' }}>
    <h2 style={{ fontFamily: T.display, fontWeight: 800, fontSize: '24px', letterSpacing: '-.01em', color: 'var(--t-tinta)', margin: '0 0 18px', paddingBottom: '10px', borderBottom: `2px solid ${BRAND_GREEN}` }}>
      {numero}. {titulo}
    </h2>
    {children}
  </section>
);

const Sub = ({ children }) => (
  <h3 style={{ fontFamily: T.display, fontWeight: 700, fontSize: '15.5px', color: 'var(--t-tinta)', margin: '22px 0 8px' }}>{children}</h3>
);

const P = ({ children }) => (
  <p style={{ margin: '0 0 12px', fontSize: '14.5px', lineHeight: 1.7, color: 'var(--t-piedra)' }}>{children}</p>
);

const Lista = ({ items, ordenada }) => {
  const Etiqueta = ordenada ? 'ol' : 'ul';
  return (
    <Etiqueta style={{ margin: '0 0 12px', paddingLeft: '22px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--t-piedra)', marginBottom: '6px' }}>{item}</li>
      ))}
    </Etiqueta>
  );
};

const Tabla = ({ encabezados, filas }) => (
  <div style={{ overflowX: 'auto', margin: '4px 0 16px', border: '1px solid var(--t-linea)', borderRadius: '10px' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
      <thead>
        <tr style={{ background: 'var(--t-niebla)' }}>
          {encabezados.map((h, i) => (
            <th key={i} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--t-tinta)', borderBottom: '1px solid var(--t-linea)', whiteSpace: 'nowrap' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--t-linea)' : 'none' }}>
            {fila.map((celda, j) => (
              <td key={j} style={{ padding: '10px 14px', color: 'var(--t-piedra)', lineHeight: 1.5, verticalAlign: 'top' }}>{celda}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SECCIONES_NAV = [
  { id: 'terminos', label: 'Términos y Condiciones' },
  { id: 'datos', label: 'Datos Personales' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'cancelaciones', label: 'Cancelaciones' },
  { id: 'pqrs', label: 'PQRS' },
];

const Politicas = () => {
  const navigate = useNavigate();

  return (
    <>
      <EstilosBase />
      <div style={{ minHeight: '100vh', background: 'var(--t-niebla)', fontFamily: T.ui }}>

        {/* CABECERA */}
        <div style={{ background: 'var(--t-monte)', padding: '18px clamp(20px, 5vw, 64px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <LogoWordmark alto={17} oscuro />
          <button onClick={() => (window.opener ? window.close() : navigate(-1))} className="t-foco"
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#EAF2EC', borderRadius: T.rControl, padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: T.display }}>
            <IconEquis size={13} />Cerrar
          </button>
        </div>

        <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(28px, 5vw, 56px) 20px 80px' }}>

          <p style={{ fontFamily: T.dato, fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', color: BRAND_GREEN, margin: '0 0 10px' }}>Turify</p>
          <h1 style={{ fontFamily: T.display, fontWeight: 800, fontSize: 'clamp(28px, 4vw, 38px)', letterSpacing: '-.02em', color: 'var(--t-tinta)', margin: '0 0 6px' }}>
            Políticas legales
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--t-piedra-clara)' }}>Última actualización: 27 de septiembre de 2026</p>

          {/* AVISO DE BORRADOR — se quita cuando un abogado lo revise */}
          <div style={{ display: 'flex', gap: '10px', background: 'var(--t-chiva-suave)', border: '1px solid var(--t-chiva-linea)', borderRadius: '10px', padding: '14px 16px', marginBottom: '28px' }}>
            <IconAlerta size={16} color="var(--t-chiva-texto)" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.6, color: 'var(--t-chiva-texto)' }}>
              <b>Este es un borrador de trabajo, no asesoría legal.</b> Se redactó con base en la Ley 1581 de 2012
              (Habeas Data) y en cómo lo resuelven plataformas similares, pero todavía necesita revisión de un
              abogado antes de considerarse definitivo — sobre todo las secciones de datos personales y
              responsabilidad frente al transporte especial.
            </p>
          </div>

          {/* NAV RÁPIDA — scrollIntoView en vez de dejar que el navegador navegue el
              href="#id" tal cual: eso empuja una entrada nueva al historial de la
              pestaña, y con más de una entrada Chrome bloquea window.close() aunque
              window.opener esté bien (ver el botón "Cerrar" de arriba). */}
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '36px' }}>
            {SECCIONES_NAV.map(s => (
              <a key={s.id} href={`#${s.id}`}
                onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--t-tinta)', background: 'var(--t-papel)', border: '1px solid var(--t-linea)', borderRadius: '999px', padding: '6px 13px', textDecoration: 'none' }}>
                {s.label}
              </a>
            ))}
          </nav>

          {/* 1. TÉRMINOS Y CONDICIONES */}
          <Seccion id="terminos" numero={1} titulo="Términos y Condiciones de Uso">
            <P>
              Turify es una plataforma tecnológica que conecta pasajeros con conductores de transporte especial e
              intermunicipal habilitados en Antioquia. <b>Turify no presta el servicio de transporte</b>: es un
              intermediario que facilita la negociación del viaje entre el pasajero y el conductor, y la
              responsabilidad de la prestación del servicio recae en el conductor y en la empresa de transporte a
              la que esté afiliado.
            </P>

            <Sub>1.1 Quién puede usar Turify</Sub>
            <Lista items={[
              <><b>Pasajeros</b>: cualquier persona mayor de edad que cree una cuenta. Puede publicar solicitudes de viaje y registrar como ocupantes a menores de edad bajo su responsabilidad.</>,
              <><b>Conductores</b>: personas mayores de 18 años, afiliadas a una empresa de transporte especial legalmente habilitada, con vehículo y documentación vigente (SOAT, licencia de conducción, tarjeta de operación, revisión tecnomecánica, seguros contractual y extracontractual). Turify verifica estos documentos antes de habilitar la cuenta, pero <b>no sustituye la habilitación que otorga la autoridad de transporte competente</b> a la empresa afiliada.</>,
            ]} />

            <Sub>1.2 Cómo funciona el viaje</Sub>
            <Lista ordenada items={[
              'El pasajero publica origen, destino, fecha y número de ocupantes.',
              <>Turify muestra un <b>precio sugerido de referencia</b> (calculado por un motor de reglas y un modelo de aprendizaje automático) — no es un precio fijo ni obligatorio.</>,
              'Los conductores cercanos envían ofertas; pasajero y conductor pueden contraofertar hasta llegar a un acuerdo.',
              <>Antes de iniciar el viaje, el conductor debe cargar el <b>FUEC (Formato Único de Extracto de Contrato)</b> expedido por su empresa afiliada, y el pasajero debe registrar los datos de todos los ocupantes, señalando cuál de ellos es el representante del viaje (el mismo pasajero que lo solicitó, siempre mayor de edad) para que la empresa afiliada lo use al diligenciar el FUEC. Ninguna de las dos partes puede iniciar el viaje sin completar ambos requisitos. Por los seguros del viaje, la lista de ocupantes solo se puede modificar hasta 48 horas antes de la salida; si el viaje se confirma con menos anticipación, se registra una sola vez.</>,
            ]} />

            <Sub>1.3 Responsabilidad</Sub>
            <P>
              Turify verifica que los documentos cargados existan y no estén vencidos al momento de la revisión,
              pero no garantiza la idoneidad del conductor, el estado mecánico del vehículo más allá de lo que
              certifican esos documentos, ni el cumplimiento de la empresa afiliada con la normativa de transporte
              especial. El FUEC lo expide la empresa afiliada, no Turify, y es esa empresa la responsable de su
              validez legal.
            </P>

            <Sub>1.4 Conducta prohibida y suspensión</Sub>
            <P>
              Está prohibido: suplantar identidad, publicar documentos falsos o vencidos, discriminar por
              cualquier motivo, y usar la plataforma para fines distintos al transporte de personas. Turify puede
              suspender o cancelar cuentas que incumplan estos términos, con previo aviso salvo riesgo de
              seguridad inminente.
            </P>

            <Sub>1.5 Viajar con mascotas</Sub>
            <P>
              Las mascotas se declaran al publicar el viaje y deben viajar en guacal o transportadora adecuada,
              con correa y con su carné de vacunación al día, conforme a la normativa vigente sobre transporte
              de animales de compañía. Cada conductor indica en su perfil si su vehículo acepta mascotas y si
              cobra un cargo adicional. Si la mascota se presenta sin guacal, el conductor puede negarse a
              transportarla sin que eso cuente como incumplimiento suyo.
            </P>

            <Sub>1.6 Ley aplicable</Sub>
            <P>
              Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia se
              someterá a la jurisdicción de los jueces colombianos.
            </P>
          </Seccion>

          {/* 2. DATOS PERSONALES */}
          <Seccion id="datos" numero={2} titulo="Política de Tratamiento de Datos Personales">
            <P>
              Esta política aplica la Ley 1581 de 2012 y el Decreto 1377 de 2013 de Colombia (régimen de Habeas
              Data). <b>Responsable del tratamiento:</b> Turify.
            </P>

            <Sub>2.1 Qué datos personales recoge Turify</Sub>
            <Tabla
              encabezados={['Dato', 'De quién', 'Para qué']}
              filas={[
                ['Nombre, correo, teléfono', 'Pasajeros y conductores', 'Crear la cuenta, contacto sobre el viaje'],
                ['Documento de identidad, licencia, SOAT, tarjeta de operación, tecnomecánica, seguros', 'Conductores', 'Verificar habilitación legal para operar'],
                ['Ubicación en tiempo real', 'Conductores (mientras están en línea o en viaje)', 'Mostrar el radar de viajes cercanos y el seguimiento en vivo'],
                ['Nombre y número de documento de cada ocupante', 'Pasajeros (al registrar el viaje)', 'Cruzar contra el FUEC que expide la empresa afiliada'],
                ['Calificaciones y comentarios', 'Pasajeros y conductores', 'Reputación dentro de la plataforma'],
                ['Cuenta de pagos: tipo, número, nombre y cédula del titular', 'Conductores', 'Mostrarles a sus pasajeros dónde pagarle, después de verificar que la cuenta esté a su nombre'],
                ['Reportes y confirmaciones de pago, reclamos', 'Pasajeros y conductores', 'Llevar la cuenta de lo pagado en cada viaje y resolver reclamos'],
                ['Ubicación al marcar cada etapa del viaje (código de abordaje, llegada al destino, regreso)', 'Conductores', 'Dejar evidencia en la bitácora del viaje para resolver reclamos'],
              ]}
            />

            <Sub>2.2 Menores de edad</Sub>
            <P>
              Un pasajero puede registrar a un menor de edad como ocupante de un viaje (por ejemplo, con Tarjeta
              de Identidad). En ese caso, el pasajero que publica el viaje <b>declara actuar como responsable o
              representante del menor</b> y garantiza contar con la autorización necesaria para compartir sus
              datos con este fin. Turify no recoge datos de menores por ningún otro canal.
            </P>

            <Sub>2.3 Con quién se comparten estos datos</Sub>
            <Lista items={[
              <><b>La empresa afiliada del conductor</b>, para la expedición y verificación del FUEC de cada viaje.</>,
              <><b>El pasajero de un viaje confirmado</b> ve la cuenta de pagos del conductor (solo si Turify ya verificó que está a nombre del conductor), para pagarle las etapas del viaje.</>,
              <><b>La pasarela de pagos</b> (cuando esté en operación), únicamente los datos necesarios para procesar el cobro.</>,
              <>Turify <b>no vende ni cede</b> datos personales a terceros con fines comerciales o publicitarios.</>,
            ]} />

            <Sub>2.4 Derechos del titular (derechos ARCO)</Sub>
            <P>
              Todo titular puede solicitar en cualquier momento: <b>Acceso</b> a sus datos, <b>Rectificación</b> de
              datos incorrectos, <b>Cancelación</b> (eliminación) cuando ya no sean necesarios, y <b>Oposición</b>{' '}
              al tratamiento cuando no exista una obligación legal de conservarlos. La solicitud se atenderá
              dentro de los plazos que fija la Ley 1581 de 2012 (10 días hábiles para consultas, 15 para
              reclamos).
            </P>
            <P>
              <b>Canal para ejercer estos derechos:</b> escribir a{' '}
              <a href="mailto:soporte.turify@gmail.com" style={{ color: BRAND_GREEN, fontWeight: 700 }}>soporte.turify@gmail.com</a>.
            </P>

            <Sub>2.5 Conservación y seguridad</Sub>
            <P>
              Los documentos de conductores y los datos de cada viaje se conservan mientras la cuenta esté activa
              y, después de eso, el tiempo que exija la trazabilidad legal del transporte especial. Turify aplica
              cifrado de contraseñas (bcrypt), autenticación por token con expiración, controles de acceso a nivel
              de fila en la base de datos (cada usuario solo puede ver lo que le corresponde) y un registro de
              auditoría de eventos de seguridad.
            </P>
          </Seccion>

          {/* 3. PAGOS */}
          <Seccion id="pagos" numero={3} titulo="Pagos del viaje">
            <P>
              El precio que acuerdan pasajero y conductor se paga por etapas, a medida que el servicio se va
              cumpliendo. Así ninguna de las dos partes arriesga todo el valor del viaje de una vez.
            </P>
            <Tabla
              encabezados={['Tipo de viaje', 'Anticipo (al confirmar)', 'Al llegar al destino', 'Al recogerlos para el regreso']}
              filas={[
                ['Ida y vuelta', '20 %', '50 %', '30 %'],
                ['Solo ida', '30 %', '70 %', '—'],
              ]}
            />

            <Sub>3.1 A quién se le paga</Sub>
            <P>
              Mientras Turify no procese pagos dentro de la app, <b>cada pago se le hace directamente al
              conductor</b>, a la cuenta que aparece en el viaje. Turify solo muestra cuentas que estén a nombre
              del conductor y que un administrador haya verificado contra su cédula. Turify no recibe ni guarda
              ese dinero. No le pagues a cuentas de otras personas ni a cuentas que no aparezcan en la app.
            </P>

            <Sub>3.2 Quien recibe el dinero, confirma</Sub>
            <P>
              El pasajero marca en la app cada pago que hace, y el conductor confirma que lo recibió. Con las
              devoluciones es al revés: el conductor la marca y el pasajero confirma que le llegó. Si alguno dice
              que el dinero no le llegó, el pago queda <b>en reclamo</b> y un administrador de Turify lo revisa.
            </P>

            <Sub>3.3 Código de abordaje</Sub>
            <P>
              Al confirmar el viaje, el pasajero recibe un <b>código de 4 dígitos</b> que le da al conductor solo
              cuando el grupo se sube al vehículo. Sin ese código el viaje no puede iniciar. En los viajes de ida y
              vuelta se genera un código nuevo para el regreso. Después de 5 intentos fallidos el código se
              bloquea 15 minutos y se le avisa al pasajero.
            </P>

            <Sub>3.4 Bitácora del viaje</Sub>
            <P>
              Cada paso del viaje queda registrado con fecha y hora: la confirmación, cada pago y cada
              confirmación, el código de abordaje, la llegada al destino, el regreso y las cancelaciones. Cuando el
              conductor marca una etapa también se guarda su ubicación. Nadie puede editar ni borrar la bitácora,
              ni siquiera Turify, y es la evidencia con la que se resuelven los reclamos.
            </P>

            <Sub>3.5 Comisión de Turify</Sub>
            <P>
              Mientras los pagos se hagan directamente al conductor, <b>Turify no cobra comisión</b>. Cuando el
              anticipo pueda pagarse dentro de la app, Turify descontará de él una comisión del <b>10 % del precio
              acordado</b>. El conductor la verá antes de aceptar el viaje, y el resto del anticipo se le entregará
              a él. Los demás pagos no tienen comisión.
            </P>

            <Sub>3.6 Reclamos de pagos</Sub>
            <P>
              El pasajero y el conductor pueden abrir un reclamo desde el viaje en la app, sobre un pago o sobre
              el servicio (por ejemplo, si el conductor no volvió por el grupo). Un administrador revisa la
              bitácora, puede contactar a las partes y decide si el pago se hizo, se sigue debiendo, se anula o se
              debe devolver. Si el conductor incumplió, puede contarse como cancelación injustificada.
            </P>
          </Seccion>

          {/* 4. CANCELACIONES */}
          <Seccion id="cancelaciones" numero={4} titulo="Política de Cancelaciones y Penalizaciones">
            <P>
              La penalización por cancelar tarde es el <b>anticipo</b>: compensa al conductor que ya había
              reservado el vehículo y el día para ese viaje.
            </P>
            <Tabla
              encabezados={['Momento', 'Quién cancela', 'Regla']}
              filas={[
                ['Antes de aceptar una oferta', 'Pasajero', 'Cancelación libre, sin penalización — todavía nadie comprometió un vehículo'],
                ['Antes de aceptar una oferta', 'Conductor', 'Puede retirar su oferta libremente'],
                ['Oferta aceptada, 24 horas o más antes de la salida', 'Pasajero', 'Sin penalización. Si ya pagó el anticipo, el conductor se lo devuelve completo.'],
                ['Oferta aceptada, menos de 24 horas antes de la salida', 'Pasajero', 'Si ya pagó el anticipo, lo pierde: queda para el conductor como compensación y Turify no cobra comisión sobre él. Si no lo había pagado, no hay penalización.'],
                ['Oferta aceptada, viaje aún no iniciado', 'Conductor', 'Devuelve todo lo que haya recibido. Si ya tenía el anticipo y no fue por fuerza mayor, queda registrado como cancelación injustificada contra su confiabilidad. El viaje vuelve a quedar disponible para que otro conductor lo tome.'],
                ['Viaje ya iniciado', 'Ninguna de las dos partes', 'No se cancela por la app. Si el grupo no regresa con el conductor, él puede cerrar el viaje sin regreso indicando el motivo; queda en la bitácora y cualquiera de los dos puede abrir un reclamo.'],
              ]}
            />

            <Sub>4.1 Fuerza mayor</Sub>
            <P>
              Condiciones climáticas severas, cierres de vía, emergencias médicas o de seguridad no se penalizan,
              siempre que se documenten con un motivo y una evidencia (foto, certificado, reporte, etc.) al momento
              de cancelar. Con fuerza mayor documentada, el pasajero recupera el anticipo aunque cancele con menos
              de 24 horas.
            </P>

            <Sub>4.2 Devoluciones</Sub>
            <P>
              Devuelve el dinero quien lo recibió: hoy, el conductor. La app le muestra lo que debe devolver, él
              marca la devolución y el pasajero confirma que le llegó. Si no le llega, el pasajero abre un reclamo
              y lo revisa un administrador (sección 3.6).
            </P>

            <Sub>4.3 Reincidencia</Sub>
            <P>
              Un número alto de cancelaciones tardías o injustificadas en un periodo (a definir, ej. 3 en 30 días)
              puede derivar en restricciones temporales para publicar viajes o recibir solicitudes, previa
              notificación al usuario. Todavía sin implementar.
            </P>
          </Seccion>

          {/* 5. PQRS */}
          <Seccion id="pqrs" numero={5} titulo="Política de PQRS (Peticiones, Quejas y Reclamos)">
            <P>
              Exigida por el artículo 50 de la Ley 1480 de 2011 (Estatuto del Consumidor): toda plataforma que
              ofrece bienes o servicios a consumidores en Colombia debe tener un canal efectivo para que cualquier
              persona radique peticiones, quejas o reclamos sobre el servicio.
            </P>

            <Sub>5.1 Qué se puede radicar por este canal</Sub>
            <Lista items={[
              'Quejas sobre un viaje, un conductor o una empresa afiliada.',
              'Reclamos por cobros, cancelaciones o penalizaciones que el usuario considere incorrectos. Los reclamos sobre un pago de un viaje también se pueden abrir desde el viaje en la app (sección 3.6).',
              'El ejercicio de los derechos de acceso, rectificación, cancelación y oposición sobre datos personales (los mismos de la sección 2.4 — es el mismo canal, no hace falta uno aparte).',
              'Sugerencias generales sobre la plataforma.',
            ]} />

            <Sub>5.2 Canal y plazos</Sub>
            <P>
              <a href="mailto:soporte.turify@gmail.com" style={{ color: BRAND_GREEN, fontWeight: 700 }}>soporte.turify@gmail.com</a> — el mismo canal de la sección 2.4 sirve para ambas cosas.
            </P>
            <P>
              Turify confirma la recepción de toda PQR y responde de fondo dentro de los <b>15 días hábiles</b>{' '}
              siguientes, plazo general para peticiones ante particulares que prestan un servicio (Ley 1480 de
              2011 y Código de Procedimiento Administrativo). Si la solicitud requiere información de la empresa
              afiliada o del conductor, Turify la traslada y hace seguimiento, pero el plazo de respuesta de
              fondo sobre la prestación misma del servicio de transporte puede depender de esa empresa.
            </P>

            <Sub>5.3 Segunda instancia</Sub>
            <P>
              Si la respuesta no resuelve la solicitud, el usuario puede acudir a la Superintendencia de Industria
              y Comercio (SIC), autoridad de protección al consumidor y de protección de datos personales en
              Colombia.
            </P>
          </Seccion>

        </div>
      </div>
    </>
  );
};

export default Politicas;
