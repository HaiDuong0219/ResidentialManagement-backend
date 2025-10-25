import express from 'express';
import {
    createHousehold,
    getAllHouseholds,
    getHouseholdById,
    getHouseholdByCode,
    getHouseholdResidents,
    updateHousehold,
    deleteHousehold
} from '../controllers/householdsController.js';

const router = express.Router();

router.post('/', createHousehold);
router.get('/', getAllHouseholds);
router.get('/:id', getHouseholdById);
router.get('/code/:household_code', getHouseholdByCode);
router.get('/:household_code/residents', getHouseholdResidents);
router.put('/:id', updateHousehold);
router.delete('/:id', deleteHousehold);

export default router;

