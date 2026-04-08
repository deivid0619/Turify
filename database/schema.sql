-- 1. Reset (Clear existing table to avoid conflicts)
DROP TABLE IF EXISTS User;

-- 2. Database Creation
CREATE DATABASE IF NOT EXISTS turify_db;
USE turify_db;

-- 3. Master User Table (Covers HU01 and HU02)
CREATE TABLE User (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    
    -- HU01 and HU02: Profiles differentiated by Role
    role ENUM('PASSENGER', 'DRIVER', 'ADMIN') DEFAULT 'PASSENGER',
    
    -- HU02: Driver-specific field (NULL for passengers)
    affiliated_company VARCHAR(100) NULL,
    
    -- HU02: Registration status (Drivers start as 'PENDING')
    status ENUM('ACTIVE', 'PENDING', 'INACTIVE') DEFAULT 'ACTIVE',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Test Data for Backend Authentication Testing
-- Passenger (HU01): Created as ACTIVE by default
INSERT INTO User (full_name, email, password_hash, role, status) 
VALUES ('Jane Doe', 'jane@test.com', 'hashed_pass_123', 'PASSENGER', 'ACTIVE');

-- Driver (HU02): Created with company and PENDING status
INSERT INTO User (full_name, email, password_hash, role, affiliated_company, status) 
VALUES ('John Driver', 'john@test.com', 'hashed_pass_456', 'DRIVER', 'Medellin Express', 'PENDING');

-- 5. Verification
SELECT * FROM User;


-- Use the existing database
USE turify_db;

-- Create the Document table for HU04 (Driver Verification)
CREATE TABLE IF NOT EXISTS Document (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,               -- Link to the User (Driver)
    vehicle_id INT NULL,                -- For future use (HU05+)
    document_type VARCHAR(50) NOT NULL, -- SOAT, Licencia, Seguros, etc.
    file_url VARCHAR(255) NOT NULL,     -- Path to the file in the server/cloud
    expiry_date DATE NULL,              -- For documents like SOAT or License
    
    -- Verification status requested in HU04 criteria
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
    
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraint: Only existing users can have documents
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- Test data for HU04: Associate a SOAT to John Driver (id 2)
INSERT INTO Document (user_id, document_type, file_url, verification_status)
VALUES (2, 'SOAT', 'https://storage.turify.com/docs/soat_john.pdf', 'PENDING');

-- Verification
SELECT * FROM Document;
