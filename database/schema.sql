-- 1. CONFIGURACIÓN INICIAL
CREATE DATABASE IF NOT EXISTS turify_db;
USE turify_db;

-- 2. TABLA DE EMPRESAS AFILIADAS (SCRUM-37)
-- Se crea primero para que los usuarios puedan referenciarlas
CREATE TABLE AffiliatedCompany (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nit VARCHAR(50) UNIQUE NOT NULL,
    logo_url VARCHAR(255) -- Link a la nube (Cloudinary/S3)
);

-- 3. TABLA DE USUARIOS (Actualizada para SCRUM-38 y perfil de conductor)
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Rol del usuario (Pasajero por defecto)
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN') DEFAULT 'PASSENGER',
    
    -- Relación con la empresa (SCRUM-38)
    company_id INT NULL, 
    
    -- Campos que se llenarán cuando el usuario quiera ser conductor (HU17)
    profile_photo_url VARCHAR(255) NULL,
    age INT NULL,
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    
    -- Estado y fecha de registro
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Conexión con la tabla de empresas
    FOREIGN KEY (company_id) REFERENCES AffiliatedCompany(company_id) ON DELETE SET NULL
);

-- 4. TABLA DE DOCUMENTOS (HU17 — Guardar archivos en la nube)
CREATE TABLE Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_type ENUM('SOAT', 'Licencia', 'Seguros', 'Certificado Afiliación', 'Antecedentes') NOT NULL,
    file_url VARCHAR(255) NOT NULL, -- URL que vendrá de la nube
    
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

CREATE TABLE Vehicle (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,   -- Se conecta con la tabla User (El conductor)
    company_id INT NOT NULL, -- Se conecta con la tabla AffiliatedCompany (La empresa)
    plate VARCHAR(20) UNIQUE NOT NULL,
    capacity INT NOT NULL,   -- Cuántos pasajeros caben en total
    photo_url VARCHAR(255),  -- Link de Cloudinary de la foto de la buseta
    
    FOREIGN KEY (owner_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES AffiliatedCompany(company_id) ON DELETE CASCADE
);

CREATE TABLE Trip (
    trip_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL, -- Se conecta con el vehículo
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    departure_time DATETIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    
    -- Control de cupos
    total_seats INT NOT NULL,
    available_seats INT NOT NULL, 
    
    -- Estado del viaje
    status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
    
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE
);

-- ==========================================================
-- VISTA PARA EL CATÁLOGO DE VIAJES (HU-06 / SCRUM-56)
-- Esta vista une las 4 tablas principales para mostrar 
-- toda la información en una sola consulta.
-- ==========================================================

CREATE OR REPLACE VIEW VistaCatalogoViajes AS
SELECT 
    -- 1. Información del Viaje
    t.trip_id,
    t.origin,
    t.destination,
    t.departure_time,
    t.price,
    t.available_seats,
    t.status AS trip_status,

    -- 2. Información del Vehículo (Busetas)
    v.plate AS vehicle_plate,
    v.photo_url AS vehicle_photo,
    v.capacity AS vehicle_capacity,

    -- 3. Información del Conductor (Perfil tipo Airbnb)
    u.full_name AS driver_name,
    u.profile_photo_url AS driver_photo,
    u.rating_avg AS driver_rating,

    -- 4. Información de la Empresa
    c.name AS company_name,
    c.logo_url AS company_logo

FROM Trip t
JOIN Vehicle v ON t.vehicle_id = v.vehicle_id
JOIN User u ON v.owner_id = u.user_id
JOIN AffiliatedCompany c ON v.company_id = c.company_id;

-- 7. TABLA DE RESERVAS (HU-07 / SCRUM-60)
-- Almacena la compra de tiquetes de un pasajero para un viaje
-- ==========================================================

CREATE TABLE Reservation (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL,        -- El viaje que se está reservando
    passenger_id INT NOT NULL,   -- El usuario (pasajero) que compra
    
    -- Datos solicitados en la SCRUM-60
    adults INT NOT NULL DEFAULT 1,  -- Cantidad de adultos
    children INT NOT NULL DEFAULT 0,-- Cantidad de niños
    
    -- Datos de facturación y control
    total_price DECIMAL(10,2) NOT NULL, -- Precio total (adultos + niños)
    status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'CONFIRMED',
    reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Relaciones (Llaves foráneas)
    FOREIGN KEY (trip_id) REFERENCES Trip(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (passenger_id) REFERENCES User(user_id) ON DELETE CASCADE
);
