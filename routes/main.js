// routes/main.js
import { Router } from "express";

const router = Router();

// Aquí puedes poner rutas principales de tu frontend o páginas públicas
router.get("/", (req, res) => {
  res.send("API principal funcionando 🚀");
});

export default router;
