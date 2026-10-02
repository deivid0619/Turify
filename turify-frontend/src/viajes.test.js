// Cómo se nombra un viaje en las tarjetas y cómo se lee el regreso de Wompi.
import { describe, it, expect } from 'vitest';
import { codigoViaje, municipioDe, detalleDireccion } from './viajes';
import { transaccionDeRegreso } from './pagos';

describe('viajes', () => {
  it('el código del viaje es el mismo del recibo en PDF', () => {
    expect(codigoViaje(128)).toBe('TFY-000128');
    expect(codigoViaje(null)).toBe('');
  });

  it('separa el municipio del resto de la dirección', () => {
    const direccion = 'Cra. 51 #11S-22, Guayabal, Medellín, Antioquia, Colombia';
    expect(municipioDe(direccion)).toBe('Medellín');
    expect(detalleDireccion(direccion)).toBe('Cra. 51 #11S-22, Guayabal');
    expect(municipioDe('Guatapé, Antioquia')).toBe('Guatapé');
    expect(detalleDireccion('Guatapé, Antioquia')).toBe('');
  });
});

describe('regreso de Wompi', () => {
  it('lee el id de la transacción', () => {
    expect(transaccionDeRegreso('?pago=wompi&id=1234-1610641025-49201')).toBe('1234-1610641025-49201');
    // Si Wompi agrega "?id=" a una URL que ya traía "?".
    expect(transaccionDeRegreso('?pago=wompi?id=1234-1610641025-49201')).toBe('1234-1610641025-49201');
  });

  it('ignora lo que no viene de Wompi o trae un id raro', () => {
    expect(transaccionDeRegreso('?id=1234-1-1')).toBeNull();
    expect(transaccionDeRegreso('?pago=wompi')).toBeNull();
    expect(transaccionDeRegreso('?pago=wompi&id=<script>')).toBeNull();
  });
});
