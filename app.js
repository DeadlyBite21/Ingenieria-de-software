import express from "express";
import cors from "cors";
import apiRouter from "./backend/api.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);

export default app;
