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

const router = express.Router();

router.post('/', createResident);
router.get('/', getAllResidents);
router.get('/statistics', getResidentStatistics);
router.get("/household/:household_id", getResidentsByHouseholdId);
router.get('/:id', getResidentById);
router.put('/:id', updateResident);
router.delete('/:id', deleteResident);

export default router;