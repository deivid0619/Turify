-- 1. DATABASE SETUP
CREATE DATABASE IF NOT EXISTS turify_db;
USE turify_db;

-- 2. TABLES (Primero las independientes, luego las que dependen de otros)

CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN') DEFAULT 'PASSENGER',
    affiliated_company VARCHAR(100) NULL,
    status ENUM('ACTIVE', 'PENDING', 'INACTIVE') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_type ENUM('SOAT', 'Licencia', 'Seguros', 'Certificado Afiliación', 'Antecedentes') NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- 3. TEST DATA (Al final de todo)

INSERT INTO User (full_name, email, password_hash, role, status) 
VALUES ('Jane Doe', 'jane@test.com', 'hashed_pass_123', 'PASSENGER', 'ACTIVE');

INSERT INTO User (full_name, email, password_hash, role, affiliated_company, status) 
VALUES ('John Driver', 'john@test.com', 'hashed_pass_456', 'DRIVER', 'Medellin Express', 'PENDING');

-- Insertamos un documento para John (que es el id 2)
INSERT INTO Document (user_id, document_type, file_url)
VALUES (2, 'SOAT', 'https://storage.turify.com/docs/soat_john.pdf');

-- 4. VERIFICATION
SELECT * FROM User;
SELECT * FROM Document;
