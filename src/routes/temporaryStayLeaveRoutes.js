import express from "express";
import {
  createTemporaryStayLeave,
  getAllTemporaryStayLeave,
  getTemporaryStayLeaveById,
  updateTemporaryStayLeave,
  deleteTemporaryStayLeave,
} from "../controllers/temporaryStayLeaveController.js";

const router = express.Router();

router.post("/", createTemporaryStayLeave);
router.get("/", getAllTemporaryStayLeave);
router.get("/:id", getTemporaryStayLeaveById);
router.put("/:id", updateTemporaryStayLeave);
router.delete("/:id", deleteTemporaryStayLeave);

export default router;
