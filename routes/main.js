import { Router } from "express";

const router = Router();

// Ruta principal (puedes cambiarla como quieras)
router.get("/", (req, res) => {
  res.send("Bienvenido a la API 🚀");
});

export default router;
