-- ==========================================================
-- 1. CONFIGURACIÓN INICIAL
-- ==========================================================
CREATE DATABASE IF NOT EXISTS turify_db;
USE turify_db;

-- ==========================================================
-- 2. ENTIDADES BASE (Configuración y Actores)
-- ==========================================================

-- 2.1 TABLA DE EMPRESAS AFILIADAS
-- Almacena las empresas de transporte legalmente constituidas.
CREATE TABLE AffiliatedCompany (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nit VARCHAR(50) UNIQUE NOT NULL,
    logo_url VARCHAR(255)
);

-- 2.2 TABLA DE USUARIOS
-- Centraliza Pasajeros, Conductores y Admins. 
-- El campo 'affiliated_company' vincula conductores con su empresa.
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN') DEFAULT 'PASSENGER',
    affiliated_company INT NULL, 
    profile_photo_url VARCHAR(255) NULL,
    age INT NULL,
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (affiliated_company) REFERENCES AffiliatedCompany(company_id) ON DELETE SET NULL
);

-- 2.3 TABLA DE DOCUMENTOS (HU-04)
-- Para validación legal de conductores y sus vehículos.
CREATE TABLE Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_type ENUM('SOAT', 'Licencia', 'Seguros', 'Certificado Afiliación', 'Antecedentes') NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- 2.4 TABLA DE VEHÍCULOS
CREATE TABLE Vehicle (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    company_id INT NOT NULL, 
    plate VARCHAR(20) UNIQUE NOT NULL,
    capacity INT NOT NULL,
    photo_url VARCHAR(255), 
    FOREIGN KEY (owner_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES AffiliatedCompany(company_id) ON DELETE CASCADE
);

-- ==========================================================
-- 3. MÓDULO DE VIAJES BAJO DEMANDA (Gestión de Negociación)
-- ==========================================================

-- 3.1 TABLA DE SOLICITUDES (HU-05: Pestaña "Mis Viajes" Pasajero)
-- El estado PENDING significa que está en el radar buscando ofertas.
CREATE TABLE ServiceRequest (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    passenger_id INT NOT NULL,
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    trip_type ENUM('ONE_WAY', 'ROUND_TRIP') NOT NULL DEFAULT 'ONE_WAY',
    departure_time DATETIME NOT NULL,
    return_time DATETIME NULL,
    adults_count INT NOT NULL,
    children_count INT DEFAULT 0,
    has_pets BOOLEAN DEFAULT FALSE,
    status ENUM('PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (passenger_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- 3.2 TABLA DE OFERTAS (HU-06/07/08: Pestaña "Mis Viajes" Conductor)
-- Maneja el ciclo de vida de la negociación de precios.
CREATE TABLE DriverOffer (
    offer_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    driver_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    offered_price DECIMAL(10,2) NOT NULL,
    status ENUM(
        'DRIVER_OFFERED',            -- El conductor envió propuesta inicial
        'PASSENGER_COUNTER_OFFERED', -- El pasajero propuso otro precio
        'ACCEPTED',                  -- Trato cerrado
        'REJECTED'                   -- Oferta descartada
    ) DEFAULT 'DRIVER_OFFERED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES ServiceRequest(request_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE
);

-- ==========================================================
-- 4. MÓDULO DE COMUNICACIÓN (Notificaciones / Campanita)
-- ==========================================================

-- 4.1 TABLA DE NOTIFICACIONES
-- Independiente de la gestión de viajes. Alimenta el icono de la "campanita".
CREATE TABLE Notification (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, -- Quién recibe el aviso
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('NEW_OFFER', 'COUNTER_OFFER', 'TRIP_ACCEPTED', 'TRIP_REJECTED', 'SYSTEM') NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ==========================================================
-- 5. OPTIMIZACIÓN Y RENDIMIENTO (Índices)
-- ==========================================================

-- Acelera el "Radar" del conductor (viajes pendientes próximos a salir)
CREATE INDEX idx_radar_active_trips ON ServiceRequest(status, departure_time);

-- Optimiza la carga de la pestaña "Mis Viajes" para pasajeros y conductores
CREATE INDEX idx_user_offers ON DriverOffer(driver_id, status);
CREATE INDEX idx_passenger_requests ON ServiceRequest(passenger_id, status);

-- Optimiza la "Campanita" de notificaciones no leídas
CREATE INDEX idx_unread_notifications ON Notification(user_id, is_read);

-- Búsqueda rápida por placa para controles de tránsito o seguridad
CREATE INDEX idx_vehicle_plate ON Vehicle(plate);
