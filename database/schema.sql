-- 1. DATABASE SETUP
CREATE DATABASE IF NOT EXISTS turify_db;
USE turify_db;

-- 2. TABLA DE EMPRESAS AFILIADAS (SCRUM-37)
CREATE TABLE AffiliatedCompany (
    company_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    nit VARCHAR(50) UNIQUE NOT NULL,
    logo_url VARCHAR(255)
);

-- 3. TABLA DE USUARIOS (Con relación SCRUM-38 y Catálogo)
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Rol por defecto
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN') DEFAULT 'PASSENGER',
    
    -- Relación con empresa (Llave foránea)
    company_id INT NULL, 
    
    -- Campos del catálogo (Sprint 2)
    profile_photo_url VARCHAR(255) NULL,
    age INT NULL,
    rating_avg DECIMAL(3,2) DEFAULT 5.0,
    
    -- Campos del sistema
    affiliated_company VARCHAR(100) NULL, -- (Columna antigua que dejaremos por ahora por seguridad)
    status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES AffiliatedCompany(company_id) ON DELETE SET NULL
);

-- 4. TABLA DE DOCUMENTOS (El "Modo Conductor")
CREATE TABLE Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_type ENUM('SOAT', 'Licencia', 'Seguros', 'Certificado Afiliación', 'Antecedentes') NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);
