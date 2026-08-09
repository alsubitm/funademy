import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import childrenRouter from "./children";
import curriculumRouter from "./curriculum";
import learningRouter from "./learning";
import parentRouter from "./parent";
import subscriptionRouter from "./subscription";
import marketingRouter from "./marketing";
import adminRouter from "./admin";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(childrenRouter);
router.use(curriculumRouter);
router.use(learningRouter);
router.use(parentRouter);
router.use(subscriptionRouter);
router.use(marketingRouter);
router.use(adminRouter);
router.use(sessionsRouter);

export default router;
