import { Router, type IRouter } from "express";
import healthRouter from "./health";
import masteringRouter from "./mastering/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use(masteringRouter);

export default router;
