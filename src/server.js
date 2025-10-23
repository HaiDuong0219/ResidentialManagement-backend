import express from 'express';
import cors from "cors";

import dotenv from 'dotenv';

import meetingsRoutes from './routes/meetingsRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import usersRoutes from './routes/usersRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

const app = express();

// Cho phép Express đọc JSON gửi từ client/Postman
app.use(express.json());

//  test qua frontend hoặc localhost khác cổng
app.use(cors());

app.use("/api/meetings", meetingsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/users", usersRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});