import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log("Conectando a la base de datos...");
        const client = await pool.connect();
        console.log("Conexión exitosa.");

        console.log("Verificando tabla 'citas'...");
        // Check if table exists
        const tableCheck = await client.query("SELECT to_regclass('public.citas');");
        if (!tableCheck.rows[0].to_regclass) {
            console.log("La tabla 'citas' NO existe. Creándola...");
            await client.query(`
            CREATE TABLE IF NOT EXISTS citas (
                id SERIAL PRIMARY KEY,
                psicologo_id INTEGER REFERENCES usuarios(id),
                paciente_id INTEGER REFERENCES usuarios(id),
                fecha_hora_inicio TIMESTAMP,
                fecha_hora_fin TIMESTAMP,
                titulo VARCHAR(255),
                notas TEXT,
                estado VARCHAR(50) DEFAULT 'pendiente',
                lugar VARCHAR(255)
            );
        `);
            console.log("Tabla 'citas' creada.");
        } else {
            console.log("La tabla 'citas' existe. Verificando columnas...");

            // Add 'estado' column if not exists
            await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='citas' AND column_name='estado') THEN 
                    ALTER TABLE citas ADD COLUMN estado VARCHAR(50) DEFAULT 'pendiente'; 
                    RAISE NOTICE 'Columna estado agregada';
                END IF;
            END $$;
        `);
            console.log("Columna 'estado' verificada/agregada.");

            // Add 'lugar' column if not exists
            await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='citas' AND column_name='lugar') THEN 
                    ALTER TABLE citas ADD COLUMN lugar VARCHAR(255); 
                    RAISE NOTICE 'Columna lugar agregada';
                END IF;
            END $$;
        `);
            console.log("Columna 'lugar' verificada/agregada.");
        }

        console.log("Migración completada exitosamente.");
        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Error durante la migración:", err);
        process.exit(1);
    }
}

migrate();
