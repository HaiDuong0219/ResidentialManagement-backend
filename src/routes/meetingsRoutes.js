import express from 'express';
import { 
    getAllMeetings,
    getMeetingById, 
    createMeeting, 
    updateMeeting, 
    deleteMeeting 
} from '../controllers/meetingsController.js';

const router = express.Router();

router.get('/', getAllMeetings);
router.get('/:id', getMeetingById);
router.post('/', createMeeting);
router.put('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);

export default router;