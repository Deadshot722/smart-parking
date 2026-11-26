-- ============================================================
-- Smart-Parking  (PostgreSQL / Supabase)
-- Integrantes: Arroyo Millán Sofía, Muñoz Gutiérrez Diego,
--              Neri Ortiz Dylan Damián, Vacio Pérez Andrea
--
-- Cómo usarlo en Supabase: SQL Editor -> New query -> pegar TODO este archivo -> Run.
-- Se puede ejecutar varias veces: borra y vuelve a crear las tablas (¡borra los datos!).
-- Cambios respecto al script original de MySQL:
--   * AUTO_INCREMENT -> GENERATED ALWAYS AS IDENTITY
--   * DATETIME -> TIMESTAMPTZ (guarda la zona horaria; la web/app muestran la hora local del dispositivo)
--   * sesion.token (CHAR 64) agregado para el inicio de sesión
--   * RLS activado en todas las tablas (ver al final)
-- ============================================================

DROP TABLE IF EXISTS comprobante, pago, estancia, boleto, tarifa, cajon, nivel,
                     operador_estacionamiento, estacionamiento, sesion, usuario CASCADE;

-- usuario (conductores y operadores)
CREATE TABLE usuario (
  id_usuario  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  correo      VARCHAR(100) NOT NULL,
  contrasena  VARCHAR(255) NOT NULL,
  rol         VARCHAR(20)  NOT NULL DEFAULT 'Conductor',
  CONSTRAINT uq_usuario_correo UNIQUE (correo),
  CONSTRAINT ck_usuario_rol CHECK (rol IN ('Conductor', 'Operador'))
);

-- sesion
CREATE TABLE sesion (
  id_sesion    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario   INT         NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_fin    TIMESTAMPTZ NULL,
  estado       VARCHAR(20) NOT NULL DEFAULT 'Activa',
  token        CHAR(64)    NULL,
  CONSTRAINT uq_sesion_token UNIQUE (token)
);

-- estacionamiento
CREATE TABLE estacionamiento (
  id_estacionamiento INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre             VARCHAR(100) NOT NULL,
  direccion          VARCHAR(200) NOT NULL,
  horario            VARCHAR(50)  NULL
);

-- operador_estacionamiento (tabla intermedia M:M): qué estacionamientos administra cada operador.
-- Al crear un estacionamiento, el backend liga aquí al operador que lo creó; solo él puede modificarlo.
CREATE TABLE operador_estacionamiento (
  id_usuario         INT NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
  id_estacionamiento INT NOT NULL REFERENCES estacionamiento (id_estacionamiento) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (id_usuario, id_estacionamiento)
);

-- nivel
CREATE TABLE nivel (
  id_nivel           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_estacionamiento INT         NOT NULL REFERENCES estacionamiento (id_estacionamiento) ON DELETE CASCADE ON UPDATE CASCADE,
  nombre             VARCHAR(50) NOT NULL,
  capacidad          INT         NOT NULL DEFAULT 0,
  CONSTRAINT uq_nivel_nombre UNIQUE (id_estacionamiento, nombre)
);

-- cajon
CREATE TABLE cajon (
  id_cajon INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_nivel INT         NOT NULL REFERENCES nivel (id_nivel) ON DELETE CASCADE ON UPDATE CASCADE,
  numero   VARCHAR(10) NOT NULL,
  estado   VARCHAR(15) NOT NULL DEFAULT 'Disponible',
  CONSTRAINT uq_cajon_numero UNIQUE (id_nivel, numero),
  CONSTRAINT ck_cajon_estado CHECK (estado IN ('Disponible', 'Ocupado'))
);

-- tarifa
CREATE TABLE tarifa (
  id_tarifa          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_estacionamiento INT          NOT NULL REFERENCES estacionamiento (id_estacionamiento) ON DELETE CASCADE ON UPDATE CASCADE,
  costo              NUMERIC(8,2) NOT NULL,
  horario            VARCHAR(50)  NULL,
  minutos_tolerancia INT          NOT NULL DEFAULT 0,
  CONSTRAINT ck_tarifa_costo CHECK (costo >= 0)
);

-- boleto
CREATE TABLE boleto (
  id_boleto     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario    INT         NULL REFERENCES usuario (id_usuario) ON DELETE SET NULL ON UPDATE CASCADE,
  folio         VARCHAR(20) NOT NULL,
  fecha_entrada TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado        VARCHAR(20) NOT NULL DEFAULT 'Activo',
  CONSTRAINT uq_boleto_folio UNIQUE (folio),
  CONSTRAINT ck_boleto_estado CHECK (estado IN ('Activo', 'Pagado', 'Finalizado'))
);

-- estancia
CREATE TABLE estancia (
  id_estancia   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_boleto     INT          NOT NULL REFERENCES boleto (id_boleto) ON DELETE CASCADE ON UPDATE CASCADE,
  id_cajon      INT          NULL REFERENCES cajon (id_cajon) ON DELETE SET NULL ON UPDATE CASCADE,
  id_tarifa     INT          NOT NULL REFERENCES tarifa (id_tarifa) ON DELETE RESTRICT ON UPDATE CASCADE,
  fecha_entrada TIMESTAMPTZ  NOT NULL,
  fecha_salida  TIMESTAMPTZ  NULL,
  duracion      NUMERIC(6,2) NULL,
  monto_total   NUMERIC(8,2) NULL,
  CONSTRAINT uq_estancia_boleto UNIQUE (id_boleto)
);

-- pago
CREATE TABLE pago (
  id_pago     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_estancia INT          NOT NULL REFERENCES estancia (id_estancia) ON DELETE CASCADE ON UPDATE CASCADE,
  fecha_pago  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  monto       NUMERIC(8,2) NOT NULL,
  metodo_pago VARCHAR(30)  NOT NULL DEFAULT 'Tarjeta (simulado)',
  estado      VARCHAR(20)  NOT NULL DEFAULT 'Pendiente',
  CONSTRAINT uq_pago_estancia UNIQUE (id_estancia)
);

-- comprobante
CREATE TABLE comprobante (
  id_comprobante    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pago           INT          NOT NULL REFERENCES pago (id_pago) ON DELETE CASCADE ON UPDATE CASCADE,
  folio             VARCHAR(20)  NOT NULL,
  fecha_emision     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  monto_pagado      NUMERIC(8,2) NOT NULL,
  tiempo_tolerancia INT          NOT NULL DEFAULT 0,
  CONSTRAINT uq_comprobante_pago UNIQUE (id_pago)
);

-- Índices para las consultas más frecuentes
CREATE INDEX ix_cajon_nivel_estado ON cajon (id_nivel, estado);
CREATE INDEX ix_boleto_usuario     ON boleto (id_usuario, estado);
CREATE INDEX ix_estancia_cajon     ON estancia (id_cajon);
CREATE INDEX ix_nivel_estac        ON nivel (id_estacionamiento);

-- ------------------------------------------------------------
-- SEGURIDAD EN SUPABASE: todas las tablas viven en el esquema "public", que Supabase expone
-- por su API REST con la llave "anon". Con RLS activado y SIN políticas, esa API no puede leer
-- ni escribir nada. Nuestro backend se conecta con el usuario "postgres" (que se salta RLS),
-- así que sigue funcionando normal.
-- ------------------------------------------------------------
ALTER TABLE usuario                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesion                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE estacionamiento          ENABLE ROW LEVEL SECURITY;
ALTER TABLE operador_estacionamiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE nivel                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cajon                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifa                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE boleto                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE estancia                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pago                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobante              ENABLE ROW LEVEL SECURITY;
