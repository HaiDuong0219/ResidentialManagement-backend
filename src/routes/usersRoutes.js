import express from 'express';
import { 
  getAllUsers,
  getUserByEmail,
  createUser, 
  updateUserByEmail, 
  deleteUserByEmail,
} from '../controllers/usersController.js'; 


const router = express.Router();

router.get('/', getAllUsers);
router.get('/search', getUserByEmail);
router.post('/', createUser);
router.put('/', updateUserByEmail);
router.delete('/', deleteUserByEmail);

export default router;