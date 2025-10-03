import express from "express";
import cors from "cors";
import apiRouter from "./backend/api.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/api", apiRouter); // <-- monta todas las rutas de apiRouter en /api

export { app };
