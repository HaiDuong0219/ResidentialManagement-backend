import express from 'express';

import dotenv from 'dotenv';

import meetingsRoutes from './routes/meetingsRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

const app = express();

app.use("/api/meetings", meetingsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});