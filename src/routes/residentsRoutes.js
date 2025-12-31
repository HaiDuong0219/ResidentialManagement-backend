import express from 'express';
import {
    createResident,
    getAllResidents,
    getResidentById,
    getResidentsByHouseholdId,
    updateResident,
    deleteResident,
    getResidentStatistics
} from '../controllers/residentsController.js';

import { getResidentLogs } from '../controllers/residentLogsController.js';

const router = express.Router();

router.post('/', createResident);
router.get('/', getAllResidents);
router.get('/statistics', getResidentStatistics);
router.get("/household/:household_id", getResidentsByHouseholdId);
router.get('/:id/logs', getResidentLogs);
router.get('/:id', getResidentById);
router.put('/:id', updateResident);
router.delete('/:id', deleteResident);

export default router;