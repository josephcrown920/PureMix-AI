import { Router, type IRouter } from "express";
import healthRouter from "./health";
import masteringRouter from "./mastering/index";
import { suggestRouter } from "./mastering/suggest";
import meRouter from "./me";
import billingRouter from "./billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(masteringRouter);
router.use(suggestRouter);
router.use(meRouter);
router.use(billingRouter);

export default router;
