CREATE DATABASE IF NOT EXISTS turify_db;
USE turify_db;
SELECT * FROM Document;
SELECT * FROM User;

-- Catálogo de empresas (Pre-cargado por Admins)
CREATE TABLE IF NOT EXISTS AffiliatedCompany (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nit VARCHAR(50) UNIQUE NOT NULL,
    logo_url VARCHAR(255)
);

-- Usuarios (Pasajeros, Conductores y Admins)
CREATE TABLE IF NOT EXISTS User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN') DEFAULT 'PASSENGER',
    
    -- Campos que se llenan al aplicar a "Quiero ser conductor"
    affiliated_company INT NULL, 
    profile_photo_url VARCHAR(255) NULL,
    age INT NULL,
    
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (affiliated_company) REFERENCES AffiliatedCompany(company_id) ON DELETE SET NULL
);

-- Documentación del conductor (Cloudinary Links)
CREATE TABLE IF NOT EXISTS Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_type ENUM(
        'SOAT', 
        'Licencia de Conduccion', 
        'Tarjeta de operacion', 
        'Tecnomecanica', 
        'Seguros Contractual y extracontractual'
    ) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- Vehículos asociados al conductor
CREATE TABLE IF NOT EXISTS Vehicle (
    vehicle_id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    company_id INT NOT NULL, 
    plate VARCHAR(20) UNIQUE NOT NULL,
    capacity INT NOT NULL,
    photo_url VARCHAR(255), 
    FOREIGN KEY (owner_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES AffiliatedCompany(company_id) ON DELETE CASCADE
);


-- 3. MÓDULO DE VIAJES (Gestión de Ofertas y Negociación)


-- Solicitudes de viaje (Publicadas por pasajeros)
CREATE TABLE IF NOT EXISTS ServiceRequest (
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

-- Ofertas de conductores (Proceso de subasta/negociación)
CREATE TABLE IF NOT EXISTS DriverOffer (
    offer_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    driver_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    offered_price DECIMAL(10,2) NOT NULL,
    status ENUM('DRIVER_OFFERED', 'PASSENGER_COUNTER_OFFERED', 'ACCEPTED', 'REJECTED') DEFAULT 'DRIVER_OFFERED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES ServiceRequest(request_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES Vehicle(vehicle_id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS Notification (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('NEW_OFFER', 'COUNTER_OFFER', 'TRIP_ACCEPTED', 'TRIP_REJECTED', 'SYSTEM') NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_offer_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE,
    FOREIGN KEY (related_offer_id) REFERENCES DriverOffer(offer_id) ON DELETE SET NULL
);



-- ==========================================================
-- 5. ÍNDICES (Optimización de rendimiento)
-- ==========================================================
-- 5. ÍNDICES (Optimización de rendimiento)
-- ==========================================================

CREATE INDEX idx_user_role ON User(role);
CREATE INDEX idx_request_status ON ServiceRequest(status);
CREATE INDEX idx_offer_request ON DriverOffer(request_id);
CREATE INDEX idx_unread_notif ON Notification(user_id, is_read);


INSERT INTO AffiliatedCompany (name, nit, logo_url) 
VALUES ('Departour', '900123456-1', 'https://tu-storage.com/logos/departour.png');

INSERT INTO AffiliatedCompany (name, nit, logo_url) 
VALUES ('Transporte Real', '900654321-2', 'https://tu-storage.com/logos/transporte_real.png');


UPDATE User 
SET role = 'ADMIN' 
WHERE email = 'usuario2@gmail.com';

USE turify_db;

CREATE TABLE IF NOT EXISTS AuditLog (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NULL,
    entity_id INT NULL,
    detail TEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_auditlog_user ON AuditLog(user_id);
CREATE INDEX idx_auditlog_action ON AuditLog(action);
CREATE INDEX idx_auditlog_created ON AuditLog(created_at);


ALTER TABLE ServiceRequest 
MODIFY COLUMN status ENUM('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING';

ALTER TABLE Notification
MODIFY COLUMN type ENUM('NEW_OFFER', 'COUNTER_OFFER', 'TRIP_ACCEPTED', 'TRIP_REJECTED', 'TRIP_STARTED', 'TRIP_COMPLETED', 'SYSTEM') NOT NULL;




