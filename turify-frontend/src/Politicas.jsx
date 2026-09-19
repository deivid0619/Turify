import { useNavigate } from 'react-router-dom';
import { T, EstilosBase, LogoWordmark, IconAlerta, IconEquis } from './diseno';

// Contenido legal — Términos, Habeas Data, Cancelaciones y PQRS. Texto tomado
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
  <h3 style={{ fontFamily: T.ui, fontWeight: 700, fontSize: '15.5px', color: 'var(--t-tinta)', margin: '22px 0 8px' }}>{children}</h3>
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
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#EAF2EC', borderRadius: T.rControl, padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: T.ui }}>
            <IconEquis size={13} />Cerrar
          </button>
        </div>

        <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(28px, 5vw, 56px) 20px 80px' }}>

          <p style={{ fontFamily: T.dato, fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', color: BRAND_GREEN, margin: '0 0 10px' }}>Turify</p>
          <h1 style={{ fontFamily: T.display, fontWeight: 800, fontSize: 'clamp(28px, 4vw, 38px)', letterSpacing: '-.02em', color: 'var(--t-tinta)', margin: '0 0 6px' }}>
            Políticas legales
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--t-piedra-clara)' }}>Última actualización: 18 de septiembre de 2026</p>

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
              <>Antes de iniciar el viaje, el conductor debe cargar el <b>FUEC (Formato Único de Extracto de Contrato)</b> expedido por su empresa afiliada, y el pasajero debe registrar los datos de todos los ocupantes, señalando cuál de ellos es el representante del viaje (el mismo pasajero que lo solicitó, siempre mayor de edad) para que la empresa afiliada lo use al diligenciar el FUEC. Ninguna de las dos partes puede iniciar el viaje sin completar ambos requisitos.</>,
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

            <Sub>1.5 Ley aplicable</Sub>
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

          {/* 3. CANCELACIONES */}
          <Seccion id="cancelaciones" numero={3} titulo="Política de Cancelaciones y Penalizaciones">
            <P>
              Esta sección corresponde a <b>HU59 (SCRUM-211)</b> en el backlog de Jira, todavía sin implementar en
              el producto — se deja redactada como base para cuando se construya.
            </P>
            <Tabla
              encabezados={['Momento', 'Quién cancela', 'Regla propuesta']}
              filas={[
                ['Antes de aceptar una oferta', 'Pasajero', 'Cancelación libre, sin penalización'],
                ['Antes de aceptar una oferta', 'Conductor', 'Puede retirar su oferta libremente'],
                ['Oferta aceptada, viaje aún no iniciado', 'Pasajero', 'Libre hasta cierto tiempo antes de la salida (ej. 2 horas); después, afecta su calificación como pasajero'],
                ['Oferta aceptada, viaje aún no iniciado', 'Conductor', 'Debe avisar lo antes posible; cancelaciones frecuentes o de último momento afectan su calificación y pueden derivar en suspensión temporal'],
                ['Viaje ya iniciado (IN_PROGRESS)', 'Ninguna de las dos partes', 'No es cancelable por la app — se resuelve directamente entre pasajero y conductor; casos de fuerza mayor (accidente, emergencia médica) se documentan aparte y no cuentan como incumplimiento'],
              ]}
            />

            <Sub>3.1 Fuerza mayor</Sub>
            <P>
              Condiciones climáticas severas, cierres de vía, emergencias médicas o de seguridad no se penalizan,
              pero deben poder documentarse (por ejemplo, con un motivo obligatorio al cancelar).
            </P>

            <Sub>3.2 Reincidencia</Sub>
            <P>
              Un número alto de cancelaciones tardías en un periodo (a definir, ej. 3 en 30 días) puede derivar en
              restricciones temporales para publicar viajes o recibir solicitudes, previa notificación al
              usuario.
            </P>
          </Seccion>

          {/* 4. PQRS */}
          <Seccion id="pqrs" numero={4} titulo="Política de PQRS (Peticiones, Quejas y Reclamos)">
            <P>
              Exigida por el artículo 50 de la Ley 1480 de 2011 (Estatuto del Consumidor): toda plataforma que
              ofrece bienes o servicios a consumidores en Colombia debe tener un canal efectivo para que cualquier
              persona radique peticiones, quejas o reclamos sobre el servicio.
            </P>

            <Sub>4.1 Qué se puede radicar por este canal</Sub>
            <Lista items={[
              'Quejas sobre un viaje, un conductor o una empresa afiliada.',
              'Reclamos por cobros, cancelaciones o penalizaciones que el usuario considere incorrectos.',
              'El ejercicio de los derechos de acceso, rectificación, cancelación y oposición sobre datos personales (los mismos de la sección 2.4 — es el mismo canal, no hace falta uno aparte).',
              'Sugerencias generales sobre la plataforma.',
            ]} />

            <Sub>4.2 Canal y plazos</Sub>
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

            <Sub>4.3 Segunda instancia</Sub>
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
