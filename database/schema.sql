-- ==========================================================
-- 1. CONFIGURACIÓN INICIAL
-- ==========================================================
CREATE DATABASE IF NOT EXISTS turify_db;
USE turify_db;


-- ==========================================================
-- 2. ENTIDADES BASE (Actores y Recursos del Sistema)
-- ==========================================================

-- 2.1 TABLA DE EMPRESAS AFILIADAS
CREATE TABLE AffiliatedCompany (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nit VARCHAR(50) UNIQUE NOT NULL,
    logo_url VARCHAR(255)
);

-- 2.2 TABLA DE USUARIOS
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN') DEFAULT 'PASSENGER',
    company_id INT NULL, 
    profile_photo_url VARCHAR(255) NULL,
    age INT NULL,
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES AffiliatedCompany(company_id) ON DELETE SET NULL
);

-- 2.3 TABLA DE DOCUMENTOS (Validación de Conductores)
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
-- 3. MÓDULO DE VIAJES BAJO DEMANDA (Modelo On-Demand)
-- ==========================================================

-- 3.1 TABLA DE SOLICITUDES (HU-06: Publicadas por el pasajero)
CREATE TABLE ServiceRequest (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    passenger_id INT NOT NULL,
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    departure_time DATETIME NOT NULL,
    seats_needed INT NOT NULL,
    status ENUM('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED') DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (passenger_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- 3.2 TABLA DE RESPUESTAS/OFERTAS (HU-07: Los conductores aplican)
CREATE TABLE DriverResponse (
    response_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    driver_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    offer_price DECIMAL(10,2) NOT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES ServiceRequest(request_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE
);

-- ==========================================================
-- 4. ÍNDICES DE RENDIMIENTO
-- ==========================================================
CREATE INDEX idx_request_status ON ServiceRequest(status);
CREATE INDEX idx_driver_response_request ON DriverResponse(request_id);

-- Índice compuesto para búsquedas rápidas de solicitudes (Radar del conductor):
CREATE INDEX idx_request_lookup ON ServiceRequest(status, departure_time);

-- Índice para buscar rápidamente a los conductores activos a notificar masivamente:
CREATE INDEX idx_active_drivers ON User(role, status);

ALTER TABLE User CHANGE company_id affiliated_company INT NULL;

SELECT * FROM user;
