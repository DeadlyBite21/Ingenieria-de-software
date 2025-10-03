import { app } from "./app.js";
import mainRouter from "./routes/main.js";

const hostname = "127.0.0.1";
const port = 3000;

// Rutas
app.use("/", mainRouter);

// Healthcheck
app.get("/health", (req, res) => {
  res.json({ health: "ok", active: true });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://${hostname}:${port}`);
});
