import { Router, type IRouter } from "express";
import healthRouter from "./health";
import certificatesRouter from "./certificates";
import palletsRouter from "./pallets";
import historyRouter from "./history";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(certificatesRouter);
router.use(palletsRouter);
router.use(historyRouter);
router.use(statsRouter);

export default router;
