-- 1. DATABASE SETUP
CREATE DATABASE IF NOT EXISTS turify_db;
USE turify_db;

-- 2. TABLA DE USUARIOS (Todos entran por aquí primero)
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,       -- Del formulario
    email VARCHAR(100) NOT NULL UNIQUE,    -- Del formulario
    phone_number VARCHAR(20) NOT NULL,     -- Del formulario (Ahora es obligatorio)
    password_hash VARCHAR(255) NOT NULL,   -- Del formulario
    
    -- Todos nacen siendo pasajeros por defecto
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN') DEFAULT 'PASSENGER',
    
    -- Este campo se llena solo si entran al Modo Conductor
    affiliated_company VARCHAR(100) NULL,
    
    -- Estado de la cuenta (Todos entran activos a la app)
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE DOCUMENTOS (El "Modo Conductor")
CREATE TABLE Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_type ENUM('SOAT', 'Licencia', 'Seguros', 'Certificado Afiliación', 'Antecedentes') NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    
    -- Estado de revisión de los documentos
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- ==========================================
-- EJEMPLO DEL NUEVO FLUJO PARA EL BACKEND
-- ==========================================

-- PASO 1: El usuario llena el formulario de tu foto
INSERT INTO User (full_name, email, phone_number, password_hash) 
VALUES ('Carlos Nuevo', 'carlos@test.com', '3001234567', 'hash_secreto');

-- PASO 2: Carlos entra a la app, va al "Modo Conductor" y sube su SOAT. 
-- (El backend usa su ID, supongamos que es el 1)
INSERT INTO Document (user_id, document_type, file_url)
VALUES (1, 'SOAT', 'https://storage.turify.com/docs/soat_carlos.pdf');

-- PASO 3: El Admin revisa el SOAT, lo aprueba y convierte a Carlos en Conductor
UPDATE Document SET verification_status = 'APPROVED' WHERE user_id = 1 AND document_type = 'SOAT';
UPDATE User SET role = 'DRIVER' WHERE user_id = 1;
