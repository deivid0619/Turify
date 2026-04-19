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
-- MÓDULO A: VIAJES PROGRAMADOS (Modelo de Catálogo/Oferta)
-- ==========================================================

-- A.1 TABLA DE VIAJES (Publicados por el conductor)
CREATE TABLE Trip (
    trip_id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    origin VARCHAR(100) NOT NULL,
    destination VARCHAR(100) NOT NULL,
    departure_time DATETIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    total_seats INT NOT NULL,
    available_seats INT NOT NULL, 
    status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE
);

-- A.2 TABLA DE RESERVAS (El pasajero compra un cupo en un viaje existente)
CREATE TABLE Reservation (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    trip_id INT NOT NULL,
    passenger_id INT NOT NULL,
    adults INT NOT NULL DEFAULT 1,
    children INT NOT NULL DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    status ENUM('PENDING', 'CONFIRMED', 'CANCELLED') DEFAULT 'CONFIRMED',
    reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES Trip(trip_id) ON DELETE CASCADE,
    FOREIGN KEY (passenger_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- A.3 VISTA PARA EL CATÁLOGO DE VIAJES PROGRAMADOS
CREATE OR REPLACE VIEW VistaCatalogoViajes AS
SELECT 
    t.trip_id, t.origin, t.destination, t.departure_time, t.price, t.available_seats, t.status AS trip_status,
    v.plate AS vehicle_plate, v.photo_url AS vehicle_photo, v.capacity AS vehicle_capacity,
    u.full_name AS driver_name, u.profile_photo_url AS driver_photo, u.rating_avg AS driver_rating,
    c.name AS company_name, c.logo_url AS company_logo
FROM Trip t
JOIN Vehicle v ON t.vehicle_id = v.vehicle_id
JOIN User u ON v.owner_id = u.user_id
JOIN AffiliatedCompany c ON v.company_id = c.company_id;

-- ==========================================================
-- MÓDULO B: VIAJES BAJO DEMANDA (Modelo Uber / InDrive)
-- ==========================================================

-- B.1 TABLA DE SOLICITUDES (Publicadas por el pasajero)
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

-- B.2 TABLA DE RESPUESTAS/OFERTAS (Los conductores aplican a la solicitud)
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

-- B.3 ÍNDICES DE RENDIMIENTO (Optimizan la velocidad del sistema)
CREATE INDEX idx_request_status ON ServiceRequest(status);
CREATE INDEX idx_driver_response_request ON DriverResponse(request_id);
-- Índice compuesto añadido para búsquedas rápidas de conductores en su zona y horario:
CREATE INDEX idx_request_lookup ON ServiceRequest(status, departure_time);
