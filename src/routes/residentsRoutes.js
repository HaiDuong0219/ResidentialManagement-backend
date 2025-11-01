import express from 'express';
import {
    createResident,
    getAllResidents,
    getResidentById,
    getResidentsByHouseholdId,
    updateResident,
    deleteResident
} from '../controllers/residentsController.js';

const router = express.Router();

router.post('/', createResident);
router.get('/', getAllResidents);
router.get('/:id', getResidentById);
router.get("/household/:household_id", getResidentsByHouseholdId);
router.put('/:id', updateResident);
router.delete('/:id', deleteResident);

export default router;