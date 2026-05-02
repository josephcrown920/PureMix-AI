import { Router, type IRouter } from "express";
import healthRouter from "./health";
import masteringRouter from "./mastering/index";
import meRouter from "./me";
import billingRouter from "./billing";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(masteringRouter);
router.use(meRouter);
router.use(billingRouter);
router.use(chatRouter);

export default router;
