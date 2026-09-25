import { Router } from "express";
import {createRoom, deleteRoom, getAllRoom, getRoom, updateAvailability, updateRoom} from '../controllers/room.js'
import { verifyAdmin } from "../utils/verifyToken.js";

const router = Router()

// CREATE
router.post('/:hotelId', verifyAdmin, createRoom)
// UPDATE
router.put('/:id', verifyAdmin, updateRoom)

//UPDATE AVAILABLE — NOTE: left unprotected intentionally, this is a separate
// business-logic vulnerability (unauthenticated room blocking) owned by
// another team member; needs proper booking-flow validation, not just verifyAdmin
router.put('/available/:id', updateAvailability)

// DELETE
router.delete('/:id/:hotelId', verifyAdmin, deleteRoom)

// GET
router.get('/:id', getRoom)

// GET ALL
router.get('/', getAllRoom)


export default router